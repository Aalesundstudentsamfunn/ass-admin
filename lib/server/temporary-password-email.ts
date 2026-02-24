type TemporaryPasswordEmailInput = {
  email: string;
  firstname?: string | null;
  lastname?: string | null;
  temporaryPassword: string;
};

type TemporaryPasswordEmailResult = { ok: true } | { ok: false; error: string };

const TEMP_PASSWORD_PROVIDER_DISABLED = "disabled";
const TEMP_PASSWORD_PROVIDER_RESEND = "resend";

/**
 * Returns configured provider for one-time password emails.
 *
 * Supported values:
 * - `resend`
 * - `disabled` (default)
 */
function getTemporaryPasswordProvider() {
  const raw = String(process.env.TEMP_PASSWORD_EMAIL_PROVIDER ?? TEMP_PASSWORD_PROVIDER_DISABLED)
    .trim()
    .toLowerCase();
  if (raw === TEMP_PASSWORD_PROVIDER_RESEND) {
    return TEMP_PASSWORD_PROVIDER_RESEND;
  }
  return TEMP_PASSWORD_PROVIDER_DISABLED;
}

/**
 * Validates whether temp-password delivery is configured.
 *
 * Returns `null` when provider is ready, otherwise a user-facing error reason.
 */
export function getTemporaryPasswordEmailReadinessError(): string | null {
  const provider = getTemporaryPasswordProvider();
  if (provider === TEMP_PASSWORD_PROVIDER_DISABLED) {
    return "Engangspassord e-post er deaktivert i miljøvariabler.";
  }
  if (provider === TEMP_PASSWORD_PROVIDER_RESEND) {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return "RESEND_API_KEY mangler.";
    }
    if (!process.env.RESEND_FROM_EMAIL?.trim()) {
      return "RESEND_FROM_EMAIL mangler.";
    }
    if (!process.env.RESEND_TEMP_PASSWORD_TEMPLATE_ID?.trim()) {
      return "RESEND_TEMP_PASSWORD_TEMPLATE_ID mangler.";
    }
    return null;
  }
  return "Ugyldig e-postleverandør for engangspassord.";
}

/**
 * Builds login URL used in temp-password emails.
 */
function getTemporaryPasswordLoginUrl() {
  return "https://admin.astudent.no/auth/login";
}

/**
 * Sends one-time password email through Resend API.
 */
async function sendTemporaryPasswordWithResend({ email, firstname, lastname, temporaryPassword }: TemporaryPasswordEmailInput): Promise<TemporaryPasswordEmailResult> {
  const apiKey = String(process.env.RESEND_API_KEY ?? "").trim();
  const from = String(process.env.RESEND_FROM_EMAIL ?? "").trim();
  const templateId = String(process.env.RESEND_TEMP_PASSWORD_TEMPLATE_ID ?? "").trim();
  const replyTo = String(process.env.RESEND_REPLY_TO_EMAIL ?? "").trim();
  const supportEmail = String(process.env.TEMP_PASSWORD_SUPPORT_EMAIL ?? "it@astudent.no").trim();
  const loginUrl = getTemporaryPasswordLoginUrl();
  const siteUrl = "https://admin.astudent.no";
  const fullName = `${firstname ?? ""} ${lastname ?? ""}`.trim();

  const body: Record<string, unknown> = {
    from,
    to: [email],
    subject: "Ditt engangspassord",
    template: {
      id: templateId,
      variables: {
        TEMP_PASSWORD: temporaryPassword,
        LOGIN_URL: loginUrl,
        SITE_URL: siteUrl,
        SUPPORT_EMAIL: supportEmail,
        FULL_NAME: fullName,
      },
    },
  };
  if (replyTo) {
    body.reply_to = replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return { ok: true };
  }

  const errorPayload = await response.json().catch(() => ({}));
  const errorMessage = typeof errorPayload?.message === "string" && errorPayload.message.trim() ? errorPayload.message : `Resend-feil (${response.status})`;
  return { ok: false, error: errorMessage };
}

/**
 * Sends one-time password email using configured provider.
 */
export async function sendTemporaryPasswordEmail(input: TemporaryPasswordEmailInput): Promise<TemporaryPasswordEmailResult> {
  const readinessError = getTemporaryPasswordEmailReadinessError();
  if (readinessError) {
    return { ok: false, error: readinessError };
  }

  const provider = getTemporaryPasswordProvider();
  if (provider === TEMP_PASSWORD_PROVIDER_RESEND) {
    return sendTemporaryPasswordWithResend(input);
  }

  return { ok: false, error: "Ugyldig e-postleverandør for engangspassord." };
}
