export function showToast(message, type = "success") {
  window.dispatchEvent(new CustomEvent("dzanex-toast", { detail: { message, type } }));
}
