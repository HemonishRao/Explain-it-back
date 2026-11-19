const previewTabs = [...document.querySelectorAll('[data-preview-tab]')];
const previewPanels = [...document.querySelectorAll('[data-preview-panel]')];
const walkthroughNote = document.querySelector('.walkthrough-note');

function showPreview(stage) {
  previewTabs.forEach((tab) => {
    const active = tab.dataset.previewTab === stage;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-pressed', String(active));
  });
  previewPanels.forEach((panel) => {
    panel.hidden = panel.dataset.previewPanel !== stage;
  });
  walkthroughNote.textContent = stage === 'feedback'
    ? 'Showing sample feedback. This walkthrough does not send anything to an AI service.'
    : 'Showing the explanation view. The checklist is hidden until submission.';
}

previewTabs.forEach((tab) => {
  tab.addEventListener('click', () => showPreview(tab.dataset.previewTab));
});

document.querySelector('[data-show-feedback]').addEventListener('click', () => showPreview('feedback'));
document.querySelector('[data-show-recall]').addEventListener('click', () => showPreview('recall'));
