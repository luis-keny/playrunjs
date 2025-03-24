const SUCCESS_ICON = `
<svg  width="24"  height="24"  viewBox="0 0 24 24"  fill="currentColor">
    <path d="M17 3.34a10 10 0 1 1 -14.995 8.984l-.005 -.324l.005 -.324a10 10 0 0 1 14.995 -8.336zm-1.293 5.953a1 1 0 0 0 -1.32 -.083l-.094 .083l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.403 1.403l.083 .094l2 2l.094 .083a1 1 0 0 0 1.226 0l.094 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" />
</svg>`

const DANGER_ICON = `
<svg width="24"  height="24"  viewBox="0 0 24 24"  fill="currentColor">
    <path d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336m-5 11.66a1 1 0 0 0 -1 1v.01a1 1 0 0 0 2 0v-.01a1 1 0 0 0 -1 -1m0 -7a1 1 0 0 0 -1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0 -1 -1" />
</svg>`

const WARNING_ICON = `
<svg width="24"  height="24"  viewBox="0 0 24 24"  fill="currentColor">
    <path d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336m-5 11.66a1 1 0 0 0 -1 1v.01a1 1 0 0 0 2 0v-.01a1 1 0 0 0 -1 -1m0 -7a1 1 0 0 0 -1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0 -1 -1" />
</svg>`

const INFO_ICON = `
<svg width="24"  height="24"  viewBox="0 0 24 24"  fill="currentColor">
    <path d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336m-5 11.66a1 1 0 0 0 -1 1v.01a1 1 0 0 0 2 0v-.01a1 1 0 0 0 -1 -1m0 -7a1 1 0 0 0 -1 1v4a1 1 0 0 0 2 0v-4a1 1 0 0 0 -1 -1" />
</svg>`

export const Notification = (() => {
  const container$ = document.querySelector('.notifications-container')

  const getIcon = (type) => {
    if (type === 'success') return SUCCESS_ICON
    if (type === 'danger') return DANGER_ICON
    if (type === 'warning') return WARNING_ICON
    if (type === 'info') return INFO_ICON
    return INFO_ICON
  }

  const createNotificationElement = (type, message) => {
    const notification$ = document.createElement('div')
    notification$.className = `notification ${type}`
    notification$.innerHTML = `
        <div class="notification-text">
            <span>${getIcon(type)}</span>
            <span>${message}</span>
        </div>
        <button class="notification-close">&times;</button>
    `
    return notification$
  }

  const add = (type, message, duration = 3000) => {
    const notificationEl$ = createNotificationElement(type, message)
    const closeBtn$ = notificationEl$.querySelector('.notification-close')

    const removeNotification = () => {
      notificationEl$.classList.add('hide')
      notificationEl$.addEventListener('animationend', () => {
        notificationEl$.remove()
      })
    }

    const timeoutId = setTimeout(removeNotification, duration)

    closeBtn$.addEventListener('click', () => {
      clearTimeout(timeoutId)
      removeNotification()
    })

    container$.appendChild(notificationEl$)
  }

  return { add }
})()
