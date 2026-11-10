export function element(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

export function icon(name) {
  const node = element("ha-icon");
  node.setAttribute("aria-hidden", "true");
  node.setAttribute("icon", name);
  return node;
}

export function button(className, action, ...children) {
  const node = element("button", className, ...children);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

export function mount(root, css, ...children) {
  const style = element("style", null, css);
  root.replaceChildren(style, ...children);
}

export function applyThemeMode(host, hass) {
  const dark = hass?.selectedTheme?.dark ?? hass?.themes?.darkMode;
  if (typeof dark === "boolean") host.dataset.themeMode = dark ? "dark" : "light";
}

export function orderChildren(parent, items) {
  let next = parent.firstChild;
  for (const item of items) {
    if (item === next) {
      next = next.nextSibling;
    } else {
      parent.insertBefore(item, next);
    }
  }
  while (next) {
    const obsolete = next;
    next = next.nextSibling;
    obsolete.remove();
  }
}
