// Shared client-side validation for storefront forms (checkout + intake forms).
// Pure validators return a Bulgarian error string when invalid, or null when OK,
// so they stay testable and reusable. The DOM helpers below render those errors
// inline under the field (red border + message) — far clearer than the browser's
// default English bubbles, and consistent across the checkout and contact forms.
// The backend re-validates everything; this is UX, not a security boundary.

/** Name: at least two characters and at least one letter (Cyrillic or Latin). */
export function validateName(raw: string): string | null {
  const v = raw.trim();
  if (v.length < 2) return 'Въведи име и фамилия.';
  if (!/\p{L}/u.test(v)) return 'Въведи валидно име.';
  return null;
}

/** Email: a single @, a dot in the domain, no spaces. */
export function validateEmail(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Въведи имейл адрес.';
  if (v.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v))
    return 'Въведи валиден имейл адрес.';
  return null;
}

/**
 * Phone: Bulgarian numbers with or without country code, plus a lenient fallback
 * for foreign customers. Separators (spaces, dashes, parens, dots) are stripped
 * first; `00` is normalised to `+`.
 *   BG:   +359 + 8–9 digits   or   0 + 8–9 digits   (mobile & landline)
 *   intl: + followed by 7–14 digits
 */
export function validatePhone(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Въведи телефонен номер.';
  const norm = v.replace(/[\s\-().]/g, '').replace(/^00/, '+');
  const bg = /^(\+359|0)\d{8,9}$/;
  const intl = /^\+\d{7,14}$/;
  if (bg.test(norm) || intl.test(norm)) return null;
  return 'Въведи валиден телефонен номер (напр. 0888 123 456).';
}

/* ---------- inline error rendering ---------- */

function fieldOf(input: HTMLElement): HTMLElement {
  return input.closest('.field') ?? input.parentElement ?? input;
}

/** Show (msg) or clear (null) an inline error under a field's input. */
export function setFieldError(input: HTMLInputElement, msg: string | null): void {
  const field = fieldOf(input);
  let err = field.querySelector<HTMLElement>('.field-error');
  if (msg) {
    input.classList.add('is-invalid');
    input.setAttribute('aria-invalid', 'true');
    if (!err) {
      err = document.createElement('span');
      err.className = 'field-error';
      field.appendChild(err);
    }
    err.textContent = msg;
  } else {
    input.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    err?.remove();
  }
}

/**
 * Wire a field to a validator: clears its error live as the user types/blurs, and
 * exposes a check() that validates on demand (for submit). Returns null when the
 * input is missing so callers can skip absent fields.
 */
export function wireField(
  input: HTMLInputElement | null,
  validator: (v: string) => string | null,
): { check: () => boolean } | null {
  if (!input) return null;
  const run = () => {
    const msg = validator(input.value);
    setFieldError(input, msg);
    return !msg;
  };
  input.addEventListener('input', () => {
    if (input.classList.contains('is-invalid')) run(); // re-check only once flagged
  });
  input.addEventListener('blur', () => {
    if (input.value.trim()) run(); // don't nag empty fields on tab-through
  });
  return { check: run };
}
