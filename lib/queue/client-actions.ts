/**
 * Client-side HTTP wrappers for printer queue operator actions.
 */

async function postJobAction(url: string, jobId: string | number) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id: jobId }),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function retryPrinterQueueJob(jobId: string | number) {
  return postJobAction("/api/admin/printer-queue/retry", jobId);
}

export async function cancelPrinterQueueJob(jobId: string | number) {
  return postJobAction("/api/admin/printer-queue/cancel", jobId);
}
