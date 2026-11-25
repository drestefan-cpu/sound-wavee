/** Opens a music link: same window in the installed app (so iOS hands it to the music app), new tab in a browser. */
export const openUrl = (url: string) => {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  if (isStandalone) {
    window.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};
