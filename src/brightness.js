export function enableBrightnessDrag(button, view, preview, commit, cancel) {
  let gesture;
  let dragged = false;

  const canAdjust = () => view.dimmable && !button.disabled;
  const levelAt = (clientX) => {
    const { left, width } = button.getBoundingClientRect();
    const fraction = (clientX - left) / Math.max(width, 1);
    const rtl = getComputedStyle(button).direction === "rtl";
    return Math.max(0, Math.min(100, Math.round((rtl ? 1 - fraction : fraction) * 100)));
  };

  button.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
    dragged = false;
    if (canAdjust()) gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  button.addEventListener("pointermove", (event) => {
    if (gesture?.id !== event.pointerId) return;
    if (!dragged) {
      const horizontal = Math.abs(event.clientX - gesture.x);
      const vertical = Math.abs(event.clientY - gesture.y);
      if (vertical > 6 && vertical > horizontal) {
        gesture = undefined;
        dragged = true;
        return;
      }
      if (horizontal < 6 || horizontal <= vertical || !canAdjust()) return;
      dragged = true;
      button.setPointerCapture(event.pointerId);
    }
    preview(levelAt(event.clientX));
  });
  button.addEventListener("pointerup", (event) => {
    if (gesture?.id !== event.pointerId) return;
    gesture = undefined;
    if (dragged) commit(levelAt(event.clientX));
  });
  const cancelGesture = (event) => {
    if (gesture?.id !== event.pointerId) return;
    gesture = undefined;
    if (dragged) cancel();
  };
  button.addEventListener("pointercancel", cancelGesture);
  button.addEventListener("lostpointercapture", cancelGesture);
  button.addEventListener("pointerleave", () => {
    if (!dragged) gesture = undefined;
  });
  button.addEventListener("click", (event) => {
    if (!dragged || event.detail === 0) return;
    dragged = false;
    event.stopImmediatePropagation();
    event.preventDefault();
  }, { capture: true });

  button.addEventListener("keydown", (event) => {
    if (!canAdjust() || event.altKey || event.ctrlKey || event.metaKey) return;
    const horizontal = getComputedStyle(button).direction === "rtl" ? -5 : 5;
    const changes = { ArrowUp: 5, ArrowDown: -5, ArrowRight: horizontal, ArrowLeft: -horizontal };
    let level;
    if (event.key === "Home") level = 0;
    else if (event.key === "End") level = 100;
    else if (Object.hasOwn(changes, event.key)) {
      level = Math.min(100, Math.max(0, (view.level ?? 0) + changes[event.key]));
    } else return;
    event.preventDefault();
    commit(level);
  });
}
