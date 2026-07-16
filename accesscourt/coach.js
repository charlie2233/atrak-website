const drills = [
  {
    labels: { en: 'Ready', zh: '准备', es: 'Listo' },
    title: { en: 'Get ready', zh: '准备好', es: 'Prepárate' },
    simple: { en: 'Face forward. Keep your body balanced.', zh: '面向前方。保持身体平衡。', es: 'Mira al frente. Mantén el equilibrio.' },
    detailed: { en: 'Face forward with your feet or chair stable. Relax your shoulders and look toward the open space.', zh: '面向前方，双脚或轮椅保持稳定。放松肩膀，看向前方空位。', es: 'Mira al frente con los pies o la silla estables. Relaja los hombros y mira el espacio abierto.' },
    seated: { en: 'Use your safe seated setup with partner staff.', zh: '在合作机构工作人员协助下使用安全坐姿。', es: 'Usa tu posición sentada segura con el personal del programa.' }
  },
  {
    labels: { en: 'Hold', zh: '持球', es: 'Sujeta' },
    title: { en: 'Hold the ball', zh: '拿住篮球', es: 'Sujeta el balón' },
    simple: { en: 'Use two hands. Hold the ball near your body.', zh: '用双手。把球拿在身体附近。', es: 'Usa las dos manos. Sostén el balón cerca de tu cuerpo.' },
    detailed: { en: 'Place one hand on each side of the ball. Hold it near your body and keep your eyes forward.', zh: '双手放在球的两侧。把球拿在身体附近，眼睛看向前方。', es: 'Pon una mano a cada lado del balón. Sostenlo cerca del cuerpo y mira al frente.' },
    seated: { en: 'Rest the ball on your lap between turns.', zh: '每次动作之间可以把球放在腿上。', es: 'Apoya el balón en tu regazo entre turnos.' }
  },
  {
    labels: { en: 'Bounce', zh: '拍球', es: 'Bota' },
    title: { en: 'Bounce the ball', zh: '把球拍下去', es: 'Bota el balón' },
    simple: { en: 'Push the ball down. Let it come back to your hand.', zh: '把球向下推。让它回到你的手中。', es: 'Empuja el balón hacia abajo. Deja que vuelva a tu mano.' },
    detailed: { en: 'Use one hand to push the ball toward the floor. Keep your hand ready for the ball to return.', zh: '用一只手把球推向地面。手保持准备，接住弹回来的球。', es: 'Usa una mano para empujar el balón al suelo. Mantén la mano lista para recibirlo.' },
    seated: { en: 'Bounce beside your chair, or roll the ball to a target.', zh: '可以在座椅旁拍球，或把球滚向目标。', es: 'Bota al lado de tu silla o rueda el balón hacia un objetivo.' }
  },
  {
    labels: { en: 'Switch', zh: '换手', es: 'Cambia' },
    title: { en: 'Switch hands', zh: '换一只手', es: 'Cambia de mano' },
    simple: { en: 'Move the ball to your other hand. Go slowly.', zh: '把球换到另一只手。慢慢来。', es: 'Pasa el balón a la otra mano. Ve despacio.' },
    detailed: { en: 'Bounce or pass the ball across your body. Receive it with your other hand and pause.', zh: '在身体前方拍球或传球。用另一只手接住，然后停一下。', es: 'Bota o pasa el balón frente a tu cuerpo. Recíbelo con la otra mano y haz una pausa.' },
    seated: { en: 'Move the ball across your lap or pass it hand to hand.', zh: '可以让球经过腿上，或在双手之间传递。', es: 'Mueve el balón sobre tu regazo o pásalo de una mano a la otra.' }
  },
  {
    labels: { en: 'Pass', zh: '传球', es: 'Pasa' },
    title: { en: 'Pass to your partner', zh: '传给你的伙伴', es: 'Pasa a tu compañero' },
    simple: { en: 'Look at your partner. Push the ball toward them.', zh: '看着你的伙伴。把球推向对方。', es: 'Mira a tu compañero. Empuja el balón hacia esa persona.' },
    detailed: { en: 'Use your agreed signal. Push the ball from your chest toward your partner.', zh: '使用你们约定的信号。从胸前把球推向伙伴。', es: 'Usa la señal acordada. Empuja el balón desde el pecho hacia tu compañero.' },
    seated: { en: 'Use a shorter distance or pass toward a large target.', zh: '可以缩短距离，或传向更大的目标。', es: 'Usa una distancia más corta o pasa hacia un objetivo grande.' }
  },
  {
    labels: { en: 'Finish', zh: '完成', es: 'Termina' },
    title: { en: 'Finish together', zh: '一起完成', es: 'Terminen juntos' },
    simple: { en: 'Stop the ball. Give your partner a thumbs-up.', zh: '停住篮球。给伙伴一个赞。', es: 'Detén el balón. Haz una señal positiva a tu compañero.' },
    detailed: { en: 'Secure the ball with two hands. Thank your partner with a thumbs-up, wave, or your preferred signal.', zh: '用双手稳住篮球。用点赞、挥手或你喜欢的信号感谢伙伴。', es: 'Asegura el balón con las dos manos. Agradece con el pulgar arriba, un saludo o tu señal preferida.' },
    seated: { en: 'Keep the ball on your lap and use your preferred signal.', zh: '可以把球放在腿上，并使用你喜欢的信号。', es: 'Mantén el balón en tu regazo y usa tu señal preferida.' }
  }
];

const ui = {
  en: { step: 'Step', of: 'of', previous: 'Previous', hear: 'Hear instruction', next: 'Next', seated: 'Seated version', seatedCue: 'Seated option', simpleControl: 'Simple instructions', simpleActive: 'Simple instructions active', detailedActive: 'Detailed instructions active', contrast: 'High contrast', settings: 'Settings', closeSettings: 'Close settings', speechUnavailable: 'Spoken instructions are not supported in this browser.', speaking: 'Speaking instruction.', speechFinished: 'Instruction finished.', speechError: 'The instruction could not be spoken.' },
  zh: { step: '步骤', of: '/', previous: '上一步', hear: '听取指令', next: '下一步', seated: '坐姿版本', seatedCue: '坐姿选择', simpleControl: '简明指令', simpleActive: '已启用简明指令', detailedActive: '已启用详细指令', contrast: '高对比度', settings: '设置', closeSettings: '关闭设置', speechUnavailable: '此浏览器不支持语音指令。', speaking: '正在播放指令。', speechFinished: '指令播放完毕。', speechError: '无法播放指令。' },
  es: { step: 'Paso', of: 'de', previous: 'Anterior', hear: 'Escuchar instrucción', next: 'Siguiente', seated: 'Versión sentada', seatedCue: 'Opción sentada', simpleControl: 'Instrucciones simples', simpleActive: 'Instrucciones simples activas', detailedActive: 'Instrucciones detalladas activas', contrast: 'Alto contraste', settings: 'Ajustes', closeSettings: 'Cerrar ajustes', speechUnavailable: 'Este navegador no admite instrucciones habladas.', speaking: 'Reproduciendo la instrucción.', speechFinished: 'La instrucción terminó.', speechError: 'No se pudo reproducir la instrucción.' }
};

let index = 0;
let simple = true;
let language = 'en';
let activeUtterance = null;
const speechSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

const elements = {
  count: document.querySelector('#step-count'),
  title: document.querySelector('#step-title'),
  instruction: document.querySelector('#step-instruction'),
  previous: document.querySelector('#previous'),
  previousLabel: document.querySelector('#previous [data-action-label]'),
  next: document.querySelector('#next'),
  nextLabel: document.querySelector('#next [data-action-label]'),
  speak: document.querySelector('#speak'),
  speakLabel: document.querySelector('#speak [data-action-label]'),
  speechStatus: document.querySelector('#speech-status'),
  language: document.querySelector('#language'),
  complexity: document.querySelector('#complexity'),
  complexityStatus: document.querySelector('#complexity-status'),
  contrast: document.querySelector('#contrast'),
  seated: document.querySelector('#seated'),
  seatedLabel: document.querySelector('.seated-toggle > span:first-child'),
  sequence: document.querySelector('#sequence-list'),
  settingsToggle: document.querySelector('[data-settings-toggle]'),
  settingsPanel: document.querySelector('[data-settings-panel]')
};

function buildSequence() {
  elements.sequence.replaceChildren(...drills.map((drill, drillIndex) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    const number = document.createElement('span');
    const label = document.createElement('span');
    button.type = 'button';
    button.dataset.index = drillIndex;
    number.className = 'sequence-number';
    number.textContent = String(drillIndex + 1);
    label.className = 'sequence-label';
    label.textContent = drill.labels[language];
    button.append(number, label);
    button.addEventListener('click', () => {
      cancelSpeech();
      index = drillIndex;
      render({ scrollSequence: true });
    });
    item.append(button);
    return item;
  }));
}

function scrollActiveSequenceIntoView() {
  const activeButton = elements.sequence.querySelector('button[aria-current="step"]');
  if (!activeButton || elements.sequence.scrollWidth <= elements.sequence.clientWidth) return;
  const padding = 8;
  const buttonLeft = activeButton.offsetLeft;
  const buttonRight = buttonLeft + activeButton.offsetWidth;
  const visibleLeft = elements.sequence.scrollLeft;
  const visibleRight = visibleLeft + elements.sequence.clientWidth;
  let nextLeft = visibleLeft;
  if (buttonLeft < visibleLeft + padding) nextLeft = buttonLeft - padding;
  if (buttonRight > visibleRight - padding) nextLeft = buttonRight - elements.sequence.clientWidth + padding;
  const maxLeft = elements.sequence.scrollWidth - elements.sequence.clientWidth;
  elements.sequence.scrollTo({ left: Math.max(0, Math.min(nextLeft, maxLeft)), behavior: 'auto' });
}

function setSpeechStatus(message, busy = false) {
  elements.speechStatus.textContent = message;
  elements.speak.setAttribute('aria-busy', String(busy));
}

function cancelSpeech({ clearStatus = true } = {}) {
  activeUtterance = null;
  if (speechSupported) window.speechSynthesis.cancel();
  elements.speak.setAttribute('aria-busy', 'false');
  if (clearStatus) elements.speechStatus.textContent = '';
}

function setSettingsOpen(open, { restoreFocus = false } = {}) {
  elements.settingsPanel.classList.toggle('is-open', open);
  elements.settingsToggle.setAttribute('aria-expanded', String(open));
  elements.settingsToggle.textContent = open ? ui[language].closeSettings : ui[language].settings;
  if (restoreFocus) elements.settingsToggle.focus();
}

function render({ scrollSequence = false } = {}) {
  const drill = drills[index];
  const words = ui[language];
  elements.count.textContent = language === 'zh' ? `${words.step} ${index + 1} ${words.of} ${drills.length}` : `${words.step} ${index + 1} ${words.of} ${drills.length}`;
  elements.title.textContent = drill.title[language];
  const baseInstruction = drill[simple ? 'simple' : 'detailed'][language];
  elements.instruction.textContent = elements.seated.checked ? `${baseInstruction} ${words.seatedCue}: ${drill.seated[language]}` : baseInstruction;
  elements.previousLabel.textContent = words.previous;
  elements.nextLabel.textContent = words.next;
  elements.speakLabel.textContent = words.hear;
  elements.seatedLabel.textContent = words.seated;
  elements.complexity.textContent = words.simpleControl;
  elements.complexity.setAttribute('aria-pressed', String(simple));
  elements.complexityStatus.textContent = simple ? words.simpleActive : words.detailedActive;
  elements.contrast.textContent = words.contrast;
  elements.settingsToggle.textContent = elements.settingsPanel.classList.contains('is-open') ? words.closeSettings : words.settings;
  document.documentElement.lang = language;
  elements.previous.disabled = index === 0;
  elements.next.disabled = index === drills.length - 1;
  [...elements.sequence.querySelectorAll('button')].forEach((button, buttonIndex) => {
    const current = buttonIndex === index;
    if (current) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
    button.dataset.complete = String(buttonIndex < index);
    button.querySelector('.sequence-label').textContent = drills[buttonIndex].labels[language];
  });
  if (!speechSupported) {
    elements.speak.disabled = true;
    setSpeechStatus(words.speechUnavailable);
  }
  if (scrollSequence) scrollActiveSequenceIntoView();
}

elements.previous.addEventListener('click', () => { if (index > 0) { cancelSpeech(); index -= 1; render({ scrollSequence: true }); } });
elements.next.addEventListener('click', () => { if (index < drills.length - 1) { cancelSpeech(); index += 1; render({ scrollSequence: true }); } });
elements.language.addEventListener('change', event => { cancelSpeech(); language = event.target.value; render(); });
elements.complexity.addEventListener('click', () => {
  cancelSpeech();
  simple = !simple;
  elements.complexity.setAttribute('aria-pressed', String(simple));
  render();
});
elements.contrast.addEventListener('click', () => {
  const active = document.body.classList.toggle('high-contrast');
  elements.contrast.setAttribute('aria-pressed', String(active));
});
elements.speak.addEventListener('click', () => {
  if (!speechSupported) {
    setSpeechStatus(ui[language].speechUnavailable);
    return;
  }
  cancelSpeech({ clearStatus: false });
  const text = `${elements.title.textContent}. ${elements.instruction.textContent}`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'zh' ? 'zh-CN' : language === 'es' ? 'es-US' : 'en-US';
  activeUtterance = utterance;
  setSpeechStatus(ui[language].speaking, true);
  utterance.onend = () => {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    setSpeechStatus(ui[language].speechFinished);
  };
  utterance.onerror = () => {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    setSpeechStatus(ui[language].speechError);
  };
  window.speechSynthesis.speak(utterance);
});
elements.seated.addEventListener('change', () => { cancelSpeech(); render(); });
elements.settingsToggle.addEventListener('click', () => {
  setSettingsOpen(!elements.settingsPanel.classList.contains('is-open'));
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && elements.settingsPanel.classList.contains('is-open')) {
    event.preventDefault();
    setSettingsOpen(false, { restoreFocus: true });
  }
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 900) setSettingsOpen(false);
});
window.addEventListener('pagehide', () => cancelSpeech());

buildSequence();
render();
