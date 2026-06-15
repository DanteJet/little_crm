function syncDateTimePicker(picker) {
  const date = picker.querySelector('[data-datetime-date]');
  const time = picker.querySelector('[data-datetime-time]');
  const value = picker.querySelector('[data-datetime-value]');
  if (!date || !time || !value) return;
  value.value = date.value && time.value ? `${date.value}T${time.value}` : '';
}

document.querySelectorAll('[data-datetime-picker]').forEach((picker) => {
  syncDateTimePicker(picker);
  picker.addEventListener('input', () => syncDateTimePicker(picker));
  picker.addEventListener('change', () => syncDateTimePicker(picker));
});


document.querySelectorAll('.modal-details').forEach((details) => {
  const backdrop = details.querySelector('.modal-backdrop');
  const close = details.querySelector('.modal-close');
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) details.open = false;
  });
  close?.addEventListener('click', () => { details.open = false; });
});
