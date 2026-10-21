'use strict';
// VisualViewport follows the space above the on-screen keyboard on phones.
function prepareForm(modal){
  modal.modalEl.addClass('nn-form-modal');
  modal.modalEl.closest?.('.modal-container')?.classList.add('nn-form-container');
  if(typeof window==='undefined')return ()=>{};
  const viewport=window.visualViewport;let timer;
  function visible(){modal.modalEl.style.setProperty('--nn-viewport-height',(viewport?.height||window.innerHeight)+'px');}
  function reveal(){clearTimeout(timer);timer=setTimeout(()=>{visible();const active=document.activeElement;if(modal.contentEl.contains(active)&&/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))active.scrollIntoView({block:'nearest',behavior:'auto'});},120);}
  visible();viewport?.addEventListener('resize',reveal);viewport?.addEventListener('scroll',visible);modal.contentEl.addEventListener('focusin',reveal);
  return ()=>{clearTimeout(timer);viewport?.removeEventListener('resize',reveal);viewport?.removeEventListener('scroll',visible);modal.contentEl.removeEventListener('focusin',reveal);};
}
module.exports={prepareForm};
