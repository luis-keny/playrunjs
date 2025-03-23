import { $ } from './utils'
import { encode, decode } from 'js-base64'
import Split from 'split-grid'
import { createEditor } from './editor'

const $iframe = $('#iframe')
const $output = $('#output')

Split({
  minSize: 5,
  columnGutters: [{
    track: 1,
    element: document.querySelector('.gutter-col-1')
  }]
})

const jsEditor = createEditor($('#editor'))

function executeCode (code) {
  const iframeWindow = $iframe.contentWindow
  const iframeDocument = $iframe.contentDocument
  $output.innerHTML = ''
  iframeDocument.open()
  iframeDocument.close()

  const consoleMethods = ['log', 'info', 'warn', 'error', 'debug']

  consoleMethods.forEach(method => {
    iframeWindow.console[method] = function (...args) {
      const outputs = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      )

      const output = outputs.join(' ').replace(/\n/g, '<br/>')
      let className = ''

      switch (method) {
        case 'error':
          className = 'console-error'
          break
        case 'warn':
          className = 'console-warn'
          break
        case 'info':
          className = 'console-info'
          break
        case 'debug':
          className = 'console-debug'
          break
        default:
          className = 'console-log'
      }

      $output.innerHTML += `<hr/><p class="${className}">${method === 'log' ? '' : `[${method.toUpperCase()}] `}${output}</p>`
    }
  })

  const infiniteLoopPatterns = [
    { pattern: /while\s*\(\s*true\s*\)/i, name: 'while (true)' },
    { pattern: /while\s*\(\s*1\s*\)/i, name: 'while (1)' },
    { pattern: /for\s*\(\s*;;\s*\)/i, name: 'for(;;)' },
    { pattern: /for\s*\(\s*;\s*true\s*;\s*\)/i, name: 'for(;true;)' },
    { pattern: /do\s*{[\s\S]*}\s*while\s*\(\s*true\s*\)/i, name: 'do {...} while (true)' }
  ]

  function findLineAndColumn (code, regex) {
    const lines = code.split('\n')
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex]
      const match = regex.exec(line)
      if (match) {
        return {
          line: lineIndex + 1,
          column: match.index + 1,
          text: match[0]
        }
      }
    }

    const match = regex.exec(code)
    if (match) {
      let pos = 0
      let lineIndex = 0

      while (pos <= match.index && lineIndex < lines.length) {
        if (pos + lines[lineIndex].length + 1 > match.index) {
          return {
            line: lineIndex + 1,
            column: match.index - pos + 1,
            text: match[0]
          }
        }
        pos += lines[lineIndex].length + 1
        lineIndex++
      }
    }

    return null
  }

  for (const { pattern, name } of infiniteLoopPatterns) {
    const location = findLineAndColumn(code, pattern)
    if (location) {
      $output.innerHTML += `<hr/><p class="error">RangeError: Potential infinite loop: '${name}' detected at line ${location.line}, column ${location.column}.</p>`

      const lines = code.split('\n')
      const startLine = Math.max(0, location.line - 2)
      const endLine = Math.min(lines.length, location.line + 2)
      let contextCode = ''

      for (let i = startLine; i < endLine; i++) {
        if (i === location.line - 1) {
          contextCode += `<p style="color: red; margin: 0;"><strong>${i + 1}:</strong> ${lines[i]}</p>`
        } else {
          contextCode += `<p style="color: gray; margin: 0;"><strong>${i + 1}:</strong> ${lines[i]}</p>`
        }
      }

      $output.innerHTML += `<div class="bg-slate-800" style="padding: 10px; border-left: 3px solid red; margin-top: 10px;">${contextCode}</div>`
      return
    }
  }

  const dangerousPatterns = [
    /document\.cookie/i,
    /localStorage/i,
    /sessionStorage/i
  ]

  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      $output.innerHTML += `<p class="error">Error de seguridad: Se detectó un patrón potencialmente peligroso: ${pattern}</p>`
      return
    }
  }

  const instrumentedCode = `
    let __loopCounter = 0;
    let __loopCheckInterval = setInterval(() => {
      if (__loopCounter > 2000) {
        clearInterval(__loopCheckInterval);
        throw new Error("RangeError: Potential infinite loop: exceeded 2000 iterations.");
      }
      __loopCounter = 0;
    }, 100);
    
    // Código original con instrumentación
    ${code.replace(/for\s*\(|while\s*\(|do\s*{/g, match => `${match} __loopCounter++;`)}
    
    // Limpiar el intervalo al finalizar
    clearInterval(__loopCheckInterval);
  `

  const timeoutId = setTimeout(() => {
    $output.innerHTML += '<p class="error">Error: Se detectó un posible bucle infinito o código que tarda demasiado en ejecutarse (límite de 3 segundos excedido)</p>'
  }, 3000)

  try {
    iframeWindow.eval(instrumentedCode)
    clearTimeout(timeoutId)
  } catch (error) {
    clearTimeout(timeoutId)
    $output.innerHTML += `<hr/><p class="error">${error.message}</p>`
  } finally {
    const newUrl = window.location.origin + '/' + encode(code)
    // eslint-disable-next-line no-undef
    history.replaceState(null, '', newUrl)
  }
}

jsEditor.onDidChangeModelContent(() => {
  $output.innerHTML = ''
  executeCode(jsEditor.getValue())
})

document.addEventListener('DOMContentLoaded', () => {
  const codeUrl = window.location.pathname.slice(1)
  if (codeUrl !== '') jsEditor.setValue(decode(codeUrl))
  executeCode(jsEditor.getValue())
})
