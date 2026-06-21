// Generic intake-form submitter. Any <form data-api-form="newsletter|contact|reviews">
// posts its named fields as JSON to the matching public endpoint. Field `name`
// attributes must match the backend DTO (email / name / phone / message /
// authorName / authorLocation / rating / body).
import { PUBLIC_BASE } from '../lib/config';
import { validateName, validateEmail, validatePhone, setFieldError } from '../lib/validate';

const toast = (msg: string) => (window as any).FFtoast?.(msg);

// Field name → format validator. Anything not listed is only checked for
// required-ness. Phone is optional on the contact form, so empty phones pass
// (the required check below handles truly-required empties).
type Validator = (v: string) => string | null;
const VALIDATORS: Record<string, Validator> = {
  name: validateName,
  customerName: validateName,
  authorName: validateName,
  email: validateEmail,
  phone: validatePhone,
  customerPhone: validatePhone,
};

type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function checkField(el: FormField): boolean {
  if (el.type === 'hidden') return true;
  const val = el.value.trim();
  let msg: string | null = null;
  if (!val) {
    if (el.required) msg = VALIDATORS[el.name]?.('') ?? 'Това поле е задължително.';
  } else {
    msg = VALIDATORS[el.name]?.(val) ?? null;
  }
  setFieldError(el as HTMLInputElement, msg);
  return !msg;
}

// Validate the whole form; show every error at once and focus the first bad field.
function validateForm(form: HTMLFormElement): boolean {
  const fields = [...form.querySelectorAll<FormField>('input[name], textarea[name], select[name]')];
  const oks = fields.map(checkField);
  if (oks.every(Boolean)) return true;
  fields.find((el) => el.classList.contains('is-invalid'))?.focus();
  return false;
}

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
  form.noValidate = true; // own validation → consistent Bulgarian inline messages
  // Live: re-validate a field once it's been flagged, so the error clears as the
  // user fixes it instead of lingering until the next submit.
  form.addEventListener('input', (e) => {
    const el = e.target as FormField;
    if (el?.name && el.classList?.contains('is-invalid')) checkField(el);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateForm(form)) {
      toast('Провери въведените данни.');
      return;
    }
    submit(form);
  });
});
