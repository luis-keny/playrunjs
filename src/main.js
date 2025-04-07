import { $ } from './utils'
import { encode, decode } from 'js-base64'
import Split from 'split-grid'
import { createEditor } from './components/editor/editor'
import { Notification } from './components/notification/notification'

import { createIcons, ClipboardCopy, Copy, Settings, FolderDown } from 'lucide'

createIcons({
  icons: {
    ClipboardCopy,
    Copy,
    Settings,
    FolderDown
  }
})

const $iframe = $('#iframe')
const $output = $('#output')
const $copyLink = $('#copy-link')
const $copyCode = $('#copy-code')
// const $setting = $('#setting')

const $importCode = $('#import-code')
const $importCodeModal = $('#import-code-modal')
const $importCodeCancel = $('#import-code-cancel')
const $importCodeInput = $('#import-code-input')
const $importCodeButton = $('#import-code-generate')

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
  const consoleLocations = findAllConsoleLocations(code)

  consoleMethods.forEach(method => {
    iframeWindow.console[method] = function (...args) {
      const location = consoleLocations.find(loc =>
        loc.method === method && !loc.used
      )
      if (location) {
        location.used = true

        // Resto de tu lógica para mostrar el output...
        const outputs = args.map(arg => {
          const typeArg = typeof arg
          if (typeArg === 'object') return arg === null ? 'null' : JSON.stringify(arg, null, 2)
          if (typeArg === 'string') return arg
          return String(arg)
        })

        const output = outputs.join(' ').replace(/\n/g, '<br/>')
        const className = `console-${method}`

        $output.innerHTML += `
          <hr/>
          <div class="result-console ${className}">
            <p>${output}</p>
            <span class="console-location" data-line="${location.line}" data-column="${location.column}">
              line ${location.line}:${location.column}
            </span>
          </div>
        `
      }
    }
  })

  const infiniteLoopPatterns = [
    { pattern: /while\s*\(\s*true\s*\)/i, name: 'while (true)' },
    { pattern: /while\s*\(\s*1\s*\)/i, name: 'while (1)' },
    { pattern: /for\s*\(\s*;;\s*\)/i, name: 'for(;;)' },
    { pattern: /for\s*\(\s*;\s*true\s*;\s*\)/i, name: 'for(;true;)' },
    { pattern: /do\s*{[\s\S]*}\s*while\s*\(\s*true\s*\)/i, name: 'do {...} while (true)' }
  ]

  function findAllConsoleLocations (code) {
    const regex = /console\.(log|error|warn|info|debug|assert|dir|dirxml|trace|group|groupEnd|time|timeEnd|count|clear|table)\s*\(/g
    const locations = []
    const lines = code.split('\n')

    lines.forEach((line, lineIndex) => {
      let match
      while ((match = regex.exec(line)) !== null) {
        locations.push({
          line: lineIndex + 1,
          column: match.index + 1,
          method: match[1],
          fullMatch: match[0]
        })
      }
    })
    return locations
  }

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

  function findErrorLocation (error, code) {
    // 1. Primero intentamos extraer la ubicación del stack trace del iframe
    const iframeLineMatch = error.stack.match(/at eval.*eval.*<anonymous>:(\d+):(\d+)/)
    if (iframeLineMatch) {
      const offset = 11
      return {
        line: parseInt(iframeLineMatch[1] - offset),
        column: parseInt(iframeLineMatch[2]),
        text: error.message
      }
    }

    // 2. Si no funciona, buscamos en el código instrumentado
    const instrumentedMatch = error.stack.match(/at.*instrumentedCode.*<anonymous>:(\d+):(\d+)/)
    if (instrumentedMatch) {
      const offset = 8
      return {
        line: parseInt(instrumentedMatch[1]) - offset,
        column: parseInt(instrumentedMatch[2]),
        text: error.message
      }
    }

    // 3. Como último recurso, buscamos el mensaje de error en el código original
    try {
      const errorPattern = new RegExp(
        error.message
          .split('\n')[0]
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i'
      )

      const location = findLineAndColumn(code, errorPattern)
      if (location) return location
    } catch (e) {
      console.warn('No se pudo crear patrón para buscar el error:', e)
    }

    // 4. Si todo falla, devolvemos una ubicación por defecto
    return {
      line: 1,
      column: 1,
      text: error.message
    }
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
      $output.innerHTML += `<p class="error">Security error: A potentially dangerous pattern was detected: ${pattern}</p>`
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
    ${code.replace(
      /(for\s*\(.*?\)|while\s*\(.*?\)|do)\s*\{/g,
      '$1 { __loopCounter++;'
    )}
    
    // Limpiar el intervalo al finalizar
    clearInterval(__loopCheckInterval);
  `

  const timeoutId = setTimeout(() => {
    $output.innerHTML += '<p class="error">Error: Possible infinite loop or code taking too long to execute (3 second limit exceeded) was detected.</p>'
  }, 3000)

  try {
    iframeWindow.eval(instrumentedCode)
    clearTimeout(timeoutId)
  } catch (error) {
    clearTimeout(timeoutId)
    const location = findErrorLocation(error, code)

    $output.innerHTML += `
    <hr/>
    <div class="result-console console-error">
      <p>${error.message}</p>
      <span class="console-location" data-line="${location.line}" data-column="${location.column}">
        line ${location.line}:${location.column}
      </span>
    </div>
    `
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
  $('#base-url').textContent = window.location.origin + '/'
  if (codeUrl !== '') jsEditor.setValue(decode(codeUrl))
  executeCode(jsEditor.getValue())
})

$copyCode.addEventListener('click', () => {
  navigator.clipboard.writeText(jsEditor.getValue())
    .then(() => {
      Notification.add('success', 'Copied to clipboard')
    })
    .catch(() => {
      Notification.add('danger', 'Failed to copy to clipboard')
    })
})

$copyLink.addEventListener('click', () => {
  const url = window.location.href

  if (!navigator.clipboard) {
    Notification.add('warning', 'Clipboard API not available')
    return
  }

  navigator.clipboard.writeText(url)
    .then(() => {
      Notification.add('success', 'Copied to clipboard')
    })
    .catch(() => {
      Notification.add('danger', 'Failed to copy to clipboard')
    })
})

$importCode.addEventListener('click', () => {
  $importCodeModal.showModal()
})

$importCodeCancel.addEventListener('click', () => {
  $importCodeModal.close()
})

$importCodeButton.addEventListener('click', () => {
  const urlBase = window.location.origin + '/'
  const inputValue = $importCodeInput.value.replace(urlBase, '')
  $importCodeInput.value = ''
  jsEditor.setValue(decode(inputValue))
  executeCode(jsEditor.getValue())
  $importCodeModal.close()
})

document.addEventListener('click', (e) => {
  if (e.target.matches('.console-location')) {
    const consoleLocation = e.target
    if (consoleLocation) {
      const line = parseInt(consoleLocation.getAttribute('data-line'))
      const column = parseInt(consoleLocation.getAttribute('data-column'))
      jsEditor.setPosition({ lineNumber: line, column })
      jsEditor.focus()
      jsEditor.revealLineInCenter(line)
    }
  }
})
