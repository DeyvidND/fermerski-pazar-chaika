// Generic intake-form submitter. Any <form data-api-form="newsletter|contact|reviews">
// posts its named fields as JSON to the matching public endpoint. Field `name`
// attributes must match the backend DTO (email / name / phone / message /
// authorName / authorLocation / rating / body).
import { PUBLIC_BASE } from '../lib/config';

const toast = (msg: string) => (window as any).FFtoast?.(msg);

async function submit(form: HTMLFormElement) {
  const endpoint = form.dataset.apiForm!;
  const fd = new FormData(form);
  const data: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    const s = String(v).trim();
    if (s === '') continue; // drop empty optionals
    data[k] = k === 'rating' ? parseInt(s, 10) : s;
  }
  const btn = form.querySelector<HTMLButtonElement>('[type="submit"]');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`${PUBLIC_BASE}/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg =
        (body?.message?.message ?? body?.message) ||
        'Възникна грешка. Опитай отново.';
      toast(Array.isArray(msg) ? msg[0] : String(msg));
      return;
    }
    const success: Record<string, string> = {
      newsletter: 'Благодарим за абонамента!',
      contact: 'Съобщението е изпратено!',
      reviews: 'Благодарим за ревюто! Ще се появи след преглед.',
    };
    toast(success[endpoint] || 'Готово!');
    form.reset();
    form.dispatchEvent(new CustomEvent('api-form:success'));
  } catch {
    toast('Няма връзка със сървъра. Опитай отново.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.querySelectorAll<HTMLFormElement>('form[data-api-form]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(form);
  });
});
