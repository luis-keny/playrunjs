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

  iframeWindow.console.log = function (...args) {
    args.forEach((arg) => {
      const output = typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      $output.innerHTML += `<hr/><p>${output}</p>`
    })
  }

  // Buscar patrones peligrosos en el código
  const dangerousPatterns = [
    // Patrones de código malicioso
    /document\.cookie/i,
    /localStorage/i,
    /sessionStorage/i,
    /XMLHttpRequest/i,
    /fetch\s*\(/i,
    /window\.open/i,
    /window\.location/i,
    /document\.domain/i,
    /eval\s*\(/i,
    /Function\s*\(/i,

    // Bucles infinitos comunes
    /while\s*\(\s*true\s*\)/i,
    /while\s*\(\s*1\s*\)/i,
    /while\s*\(\s*['"]\w*['"]\s*\)/i, // while ("algo")
    /while\s*\(\s*!\s*0\s*\)/i, // while (!0)
    /while\s*\(\s*!\s*false\s*\)/i, // while (!false)
    /for\s*\(\s*;;\s*\)/i, // for(;;)
    /for\s*\(\s*;\s*true\s*;\s*\)/i, // for(;true;)
    /for\s*\(\s*;\s*1\s*;\s*\)/i, // for(;1;)
    /for\s*\(\s*.*\s*;\s*;\s*\)/i, // for(var i=0;;)
    /for\s*\(\s*(?:[^;]*;\s*[^;]*;\s*)\s*\)/i, // for(let i=0; i<5; )
    // /for\s*\(\s*(?:[^;]*;\s*[^;]*)\s*\)/i, // for(let i=0; i<5)
    /while\s*\(\s*[0-9]+\s*\)/i, // while(1), while(42)
    /setInterval\s*\(\s*.*\s*,\s*[0-9]+\s*\)/i, // setInterval muy rápido
    /setTimeout\s*\(\s*.*\s*,\s*0\s*\)/i, // setTimeout con autorecursión

    // Recursión sin caso base
    /function\s+\w+\s*\([^)]*\)\s*{\s*.*\1\s*\(/i, // Recursión simple

    // Patrones de consumo excesivo de memoria
    /new Array\s*\(\s*1e[6-9]\s*\)/i, // Arrays enormes
    /\.repeat\s*\(\s*1e[6-9]\s*\)/i // String.repeat con valores enormes
  ]

  // Comprobar si el código contiene patrones peligrosos
  for (const pattern of dangerousPatterns) {
    if (pattern.test(code)) {
      $output.innerHTML += `<p class="error">Error de seguridad: Se detectó un patrón potencialmente peligroso: ${pattern}</p>`
      return
    }
  }

  const timeoutId = setTimeout(() => {
    $output.innerHTML += '<p class="error">Error: Se detectó un posible bucle infinito o código que tarda demasiado en ejecutarse (límite de 3 segundos excedido)</p>'
  }, 3000)

  try {
    iframeWindow.eval(code)
    clearTimeout(timeoutId)
  } catch (error) {
    clearTimeout(timeoutId)
    $output.innerHTML += `<hr/><p class="error">Error: ${error.message}</p>`
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
