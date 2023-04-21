import anime from "animejs"

export function collapsePanel(panel: HTMLDivElement) {
    panel.classList.add('collapsed')
    anime({
        targets: panel,
        opacity: 0,
        maxHeight: 0,
        duration: 500,
        easing: 'easeInOutQuad',
    })
}

export function expandPanel(panel: HTMLDivElement) {
    panel.classList.remove('collapsed')
    anime({
        targets: panel,
        opacity: 1,
        maxHeight: '100vh',
        duration: 300,
        easing: 'easeInOutQuad',
    })
}

export function showPanel(panel: HTMLDivElement, delay: number) {
    panel.classList.remove('panel-hidden')

    anime({
      targets: panel,
      translateY: [17, 0],
      opacity: [0, 1],
      duration: 1500,
      delay: delay,
      easing: 'easeOutElastic(1, 0.5)',
    })
}
