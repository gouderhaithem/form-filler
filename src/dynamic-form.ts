const code=document.getElementById('project-code') as HTMLInputElement;
code.addEventListener('change',()=>{
  if(document.getElementById('confirm-code')) return;
  const revealed=document.getElementById('revealed')!;
  const label=document.createElement('label');label.htmlFor='confirm-code';label.textContent='Confirm project code';
  const input=document.createElement('input');input.id='confirm-code';input.name='confirmCode';
  revealed.append(label,input);
});
