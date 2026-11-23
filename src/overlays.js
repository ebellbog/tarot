import { el } from "./dom.js";

// ---------- modal dialog ----------

/**
 * Modal dialog built on <dialog>. Resolves with `{ value, input }` for the action the
 * user chose (`input` is the text field's content, if one was requested), or `null`
 * if they cancelled (Cancel button or Escape).
 *
 * actions: [{ label, value, kind?: "primary" | "danger" }]. With an input field,
 * Enter picks the "primary" action (or the first one). Without one, focus starts on
 * Cancel so a stray Enter can never trigger a destructive action.
 */
export function openDialog({ title, message = "", input = null, actions = [], cancelLabel = "Cancel" }) {
  return new Promise((resolve) => {
    let result = null;

    const inputEl = input
      ? el("input", {
          type: "text",
          class: "dialog-input",
          value: input.value ?? "",
          placeholder: input.placeholder ?? "",
          maxLength: input.maxLength ?? 40,
          "aria-label": input.label ?? title,
        })
      : null;

    const choose = (value) => {
      result = { value, input: inputEl ? inputEl.value : null };
      dialog.close();
    };

    const buttons = actions.map((a) =>
      el("button", { type: "button", class: `button${a.kind ? ` button--${a.kind}` : ""}`, onClick: () => choose(a.value) }, a.label),
    );
    const cancel = cancelLabel && el("button", { type: "button", class: "button button--ghost", onClick: () => dialog.close() }, cancelLabel);

    const dialog = el(
      "dialog",
      { class: "dialog", "aria-label": title },
      el("h3", {}, title),
      message && el("p", { class: "dialog-message" }, message),
      inputEl,
      el("div", { class: "dialog-actions" }, cancel, ...buttons),
    );
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(result);
    });
    inputEl?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || actions.length === 0) return;
      e.preventDefault();
      choose((actions.find((a) => a.kind === "primary") ?? actions[0]).value);
    });

    document.body.append(dialog);
    dialog.showModal();
    inputEl?.select();
  });
}

// ---------- context menu ----------

let active = null; // { menu, opener, cleanup }

export function closeContextMenu({ restoreFocus = false } = {}) {
  if (!active) return;
  const { menu, opener, cleanup } = active;
  active = null;
  cleanup();
  menu.remove();
  if (restoreFocus && opener?.isConnected) opener.focus();
}

/** Open a menu at viewport coordinates. items: [{ heading } (non-selectable section title) | { label, onSelect, hint?, danger?, accent?, separator? }] (hint: muted text at the right edge) (separator: rule above) */
export function openContextMenu(x, y, items) {
  closeContextMenu();
  const opener = document.activeElement;

  const menu = el(
    "div",
    { class: "context-menu", role: "menu" },
    ...items.map((item) =>
      item.heading ? el("div", { class: "menu-heading", role: "presentation" }, item.heading) :
      el(
        "button",
        {
          type: "button",
          role: "menuitem",
          class: [item.danger && "danger", item.accent && "accent", item.separator && "separator"].filter(Boolean).join(" "),
          onClick: () => {
            closeContextMenu();
            item.onSelect();
          },
        },
        item.label,
        item.hint && el("span", { class: "hint" }, item.hint),
      ),
    ),
  );
  document.body.append(menu);

  // Keep the menu fully on screen.
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.max(4, Math.min(x, window.innerWidth - width - 4))}px`;
  menu.style.top = `${Math.max(4, Math.min(y, window.innerHeight - height - 4))}px`;

  const entries = [...menu.querySelectorAll("button")];
  const onPointerDown = (e) => {
    if (!menu.contains(e.target)) closeContextMenu();
  };
  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeContextMenu({ restoreFocus: true });
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const i = entries.indexOf(document.activeElement);
      const step = e.key === "ArrowDown" ? 1 : -1;
      entries[(i + step + entries.length) % entries.length].focus();
    }
  };
  const dismiss = () => closeContextMenu();
  const onScroll = (e) => {
    if (!menu.contains(e.target)) closeContextMenu(); // scrolling a long menu itself is fine
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("blur", dismiss);
  window.addEventListener("resize", dismiss);
  window.addEventListener("scroll", onScroll, true);
  const cleanup = () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("blur", dismiss);
    window.removeEventListener("resize", dismiss);
    window.removeEventListener("scroll", onScroll, true);
  };

  active = { menu, opener, cleanup };
  entries[0]?.focus({ preventScroll: true });
}
