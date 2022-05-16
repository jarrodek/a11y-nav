class A11yNav {
  root?: HTMLUListElement;

  protected _focused?: HTMLLIElement

  /**
   * A reference to the currently focused element.
   * Focused is not the same as selected. While the selected item indicates
   * which node is currently selected, the `focused` indicates where on the list
   * the focus occurs.
   */
  get focused(): HTMLLIElement | undefined {
    return this._focused;
  }

  set focused(value: HTMLLIElement | undefined) {
    if (this._focused === value) {
      return;
    }
    if (this._focused) {
      this._focused.removeAttribute('tabindex');
    }
    this._focused = value;
    if (value) {
      this.root!.removeAttribute('tabindex');
      value.setAttribute('tabindex', '0')
      value.focus();
    } else {
      this.root!.setAttribute('tabindex', '0');
    }
  }

  protected _selected?: string;

  /**
   * @The `data-id` value of the selected list item.
   */
  get selected(): string | undefined {
    return this._selected;
  }

  set selected(value: string | undefined) {
    const old = this._selected;
    if (old === value) {
      return;
    }
    this._selected = value;
    this._toggleSelected(value, old);
  }

  initialize(): void {
    const root = document.querySelector('.root') as HTMLUListElement;
    this.root = root;
    this.root.addEventListener('focus', this._focusHandler.bind(this));
    this.root.addEventListener('click', this._clickHandler.bind(this));
    this.root.addEventListener('keydown', this._keydownHandler.bind(this));
    this.root.addEventListener('dblclick', this._dblClickHandler.bind(this));
  }

  /**
   * @returns The first list element on the root list or null if the tree is empty.
   */
  protected _firstListItem(): HTMLLIElement | null {
    return this.root!.querySelector('li');
  }

  /**
   * Traverses the event's composed path and returns the first LI element that is not disabled.
   */
  protected _findClosestListItem(e: Event): HTMLLIElement | undefined {
    const path = e.composedPath();
    while (path.length) {
      const target = path.shift() as Node;
      if (!target) {
        break;
      }
      if (target.nodeType !== Node.ELEMENT_NODE) {
        continue;
      }
      if (!this._isValidListItem(target as Element)) {
        continue;
      }
      return target as HTMLLIElement;
    }
    return undefined;
  }

  /**
   * A function to determine whether the passed Element is an active list item.
   * 
   * @param node The Element to test
   * @returns true when the passed element is a `li` element and is not disabled.
   */
  protected _isValidListItem(node: Element): boolean {
    return node.localName === 'li' && node.getAttribute('aria-disabled') !== 'true' && node.hasAttribute('data-id');
  }

  /**
   * Manages focus state when there was no previous selection.
   * When this function is called it means the element has `tabindex=0`. We remove this and move 
   * focus to the first available element.
   */
  protected _focusHandler(): void {
    const li = this._firstListItem();
    if (!li) {
      return;
    }
    this.root!.removeAttribute('tabindex');
    this.focused = li;
  }

  /**
   * Toggles the selection state. In a UI framework this would be done through the state
   * but we use plain JS (well, TS) so we do this manually.
   * #useThePlatform
   * 
   * @param current The value of the `data-id` of the new selected node. Optional.
   * @param old The value of the `data-id` of the previously selected node. Optional.
   * It has no effect when both arguments are not set.
   */
  protected _toggleSelected(current?: string, old?: string): void {
    if (old) {
      const oldItem = document.querySelector(`[data-id="${old}"]`);
      oldItem?.classList.remove('selected');
      oldItem?.removeAttribute('aria-selected');
    }
    if (current) {
      const newItem = document.querySelector(`[data-id="${current}"]`);
      newItem?.classList.add('selected');
      newItem?.setAttribute('aria-selected', 'true');
    }
  }

  /**
   * Handler for the double click event.
   * Performs the default action on a list item.
   */
  protected _dblClickHandler(e: Event): void {
    if (e.defaultPrevented) {
      return;
    }
    const node = this._findClosestListItem(e);
    if (!node) {
      return;
    }
    this._itemEnterAction(node);
  }

  /**
   * Handler for the click event.
   */
  protected _clickHandler(e: Event): void {
    if (e.defaultPrevented) {
      return;
    }
    const node = this._findClosestListItem(e);
    if (!node) {
      return;
    }
    const key = node.dataset.id as string;
    if (node.classList.contains('parent-item')) {
      const target = e.target as HTMLElement;
      if (target.classList && target.classList.contains('group-toggle-icon')) {
        this.toggleGroup(key);
        return;
      }
    }
    this.focused = node;
  }

  /**
   * Supports accessibility through keyboard.
   */
  protected _keydownHandler(e: KeyboardEvent): void {
    const node = this._findClosestListItem(e);
    if (!node) {
      return;
    }
    switch (e.key) {
      case 'ArrowRight': this._itemRightAction(node); break;
      case 'ArrowLeft': this._itemLeftAction(node); break;
      case 'ArrowDown': this._itemDownAction(node); break;
      case 'ArrowUp': this._itemUpAction(node); break;
      case 'Home': this._homeAction(); break;
      case 'End': this._endAction(); break;
      case 'Enter': this._itemEnterAction(node); break;
      default:
    }
  }

  /**
   * Performs the default action of the currently focused node. 
   * For parent nodes, it opens or closes the node. 
   * In single-select trees, if the node has no children, selects the current node 
   * if not already selected (which is the default action).
   */
  protected _itemEnterAction(node: HTMLElement): void {
    const key = node.dataset.id as string;
    const isParent = node.classList.contains('parent-item');
    if (isParent) {
      this.toggleGroup(key);
    }
    this.selected = key;
  }

  /**
   * Toggles visibility of a group.
   * @param key The `data-key` value of the list item that toggles the group.
   */
  toggleGroup(key: string): void {
    const group = this.root!.querySelector(`[data-id="${key}"]`) as HTMLLIElement | null;
    if (!group) {
      return;
    }
    if (group.getAttribute('aria-expanded') === 'false') {
      this._openGroup(group);
    } else {
      this._closeGroup(group);
    }
  }

  protected _openGroup(node: HTMLLIElement): void {
    node.setAttribute('aria-expanded', 'true');
    node.classList.add('opened');
    const list = node.querySelector('ul');
    list?.removeAttribute('hidden');
    list?.setAttribute('aria-hidden', 'false');
  }

  protected _closeGroup(node: HTMLLIElement): void {
    node.setAttribute('aria-expanded', 'false');
    node.classList.remove('opened');
    const list = node.querySelector('ul');
    list?.setAttribute('hidden', '');
    list?.setAttribute('aria-hidden', 'true');
  }

  /**
   * 1. When focus is on a closed node, opens the node; focus does not move.
   * 2. When focus is on a open node, moves focus to the first child node.
   * 3. When focus is on an end node (a tree item with no children), does nothing.
   */
  protected _itemRightAction(node: HTMLLIElement): void {
    const isParent = node.classList.contains('parent-item');
    if (!isParent) {
      return;
    }
    if (node.getAttribute('aria-expanded') !== 'true') {
      // #1
      this._openGroup(node);
      return;
    }
    this._focusFirstDescendant(node);
  }

  /**
   * 1. When focus is on an open node, closes the node.
   * 2. When focus is on a child node that is also either an end node or a closed node, moves focus to its parent node.
   * 3. When focus is on a closed `tree`, does nothing.
   */
  protected _itemLeftAction(node: HTMLLIElement): void {
    const isParent = node.classList.contains('parent-item');
    if (isParent) {
      if (node.getAttribute('aria-expanded') === 'true') {
        // #1
        this._closeGroup(node);
        return;
      }
    }
    // #2
    this._focusFirstParent(node);
    // note, #3 won't happen here as the outer tree is always opened.
  }

  /**
   * Moves focus to the next node that is focusable without opening or closing a node.
   */
  protected _itemDownAction(node: HTMLLIElement): void {
    const isParent = node.classList.contains('parent-item');
    // try focusing on any child
    if (isParent && this._focusFirstDescendant(node)) {
      return;
    }
    // try focus on any next item.
    if (this.focusNextSibling(node)) {
      return;
    }
    let parent = this._findParentListItem(node);
    while (parent) {
      if (this.focusNextSibling(parent)) {
        return;
      }
      parent = this._findParentListItem(parent);
    }
  }

  /**
   * Moves focus to the previous node that is focusable without opening or closing a node.
   */
  protected _itemUpAction(node: HTMLLIElement): void {
    if (this.focusPreviousSibling(node)) {
      return;
    }
    this._focusFirstParent(node);
  }

  protected _homeAction(): void {
    const children = Array.from(this.root!.children) as HTMLElement[];
    for (const node of children) {
      if (this._isValidListItem(node)) {
        this.focused = node as HTMLLIElement;
      }
    }
  }

  protected _endAction(): void {
    const children = Array.from(this.root!.children).reverse() as HTMLElement[];
    for (const node of children) {
      if (this._isValidListItem(node)) {
        this.focused = node as HTMLLIElement;
      }
    }
  }

  /**
   * Focuses on a list descendant of a folder item.
   * It does nothing when the `node` is not a folder item or the folder has no selectable children.
   * 
   * @param node The node to use as a reference. The current focused node by default.
   * @returns true when focused on any of the descendants
   */
  protected _focusFirstDescendant(node = this.focused): boolean {
    if (!node) {
      return false;
    }
    const list = Array.from(node.children).find(n => n.localName === 'ul' && (!n.hasAttribute('aria-hidden') || n.getAttribute('aria-hidden') === 'false'));
    if (!list || !list.children) {
      return false;
    }
    const children = Array.from(list.children);
    for (const child of children) {
      if (!this._isValidListItem(child)) {
        continue;
      }
      const typed = child as HTMLLIElement;
      this.focused = typed;
      return true;
    }
    return false;
  }

  /**
   * Focuses on the next node relative to the passed node.
   * 
   * @param node The node to use as a starting point. When not set it uses the currently focused node.
   * @returns true when focused on any of the next siblings
   */
  focusNextSibling(node = this.focused): boolean {
    if (!node) {
      return false;
    }
    let current = node.nextElementSibling as HTMLElement;
    while (current) {
      if (!this._isValidListItem(current)) {
        current = node.nextElementSibling as HTMLElement;
        continue;
      }
      this.focused = current as HTMLLIElement;
      return true;
    }
    return false;
  }

  /**
   * Focuses on the previous node relative to the passed node.
   * 
   * @param node The node to use as a starting point. When not set it uses the currently focused node.
   * @returns true when focused on any of the previous siblings
   */
  focusPreviousSibling(node = this.focused): boolean {
    if (!node) {
      return false;
    }
    let current = node.previousElementSibling as HTMLElement;
    while (current) {
      if (!this._isValidListItem(current)) {
        current = node.previousElementSibling as HTMLElement;
        continue;
      }
      // now we find the last descendant of this node.
      // if it doesn't have one, we focus on the node we have.
      const last = this._findLastDescendant(current);
      if (last) {
        this.focused = last as HTMLLIElement;
      } else {
        this.focused = current as HTMLLIElement;
      }
      return true;
    }
    return false;
  }

  /**
   * Finds a valid list item that is a parent to the current item.
   * 
   * @param node The current node located somewhere in the tree.
   * @returns The nearest parent list item or undefined when not found.
   */
  protected _findParentListItem(node: HTMLElement): HTMLLIElement | undefined {
    let parent = node.parentElement as HTMLElement;
    while (parent) {
      if (this._isValidListItem(parent)) {
        return parent as HTMLLIElement;
      }
      // when the `parentElement` is ShadowRoot then it's parent is `null` so the loop breaks.
      parent = parent.parentElement as HTMLElement;
    }
    return undefined;
  }

  /**
   * From a `<li>` it finds the last `<li>` descendant in the tree.
   * 
   * ```html
   * <ul>
   *  <li> <-- this is the current node
   *    <div>...</div>
   *    <ul>
   *       <li>...</li>
   *       <li>  <-- this is the last list item.
   *          <div>...</div>
   *          <ul hidden> <- this is ignored.
   *            <li></li>
   *            <li></li>  <-- this is not the last list item because the parent list is hidden.
   *          </ul>
   *      </li>
   *    </ul>
   *  </li>
   * </ul>
   * ```
   * 
   * @param node The current list item to find the last descendant for.
   * @returns The last list item or undefined.
   */
  protected _findLastDescendant(node: HTMLElement): HTMLElement | undefined {
    const list = Array.from(node.children).reverse().find(i => i.localName === 'ul' && !i.hasAttribute('hidden')) as HTMLElement | undefined;
    if (!list) {
      return undefined;
    }
    const li = Array.from(list.children).reverse().find(i => this._isValidListItem(i)) as HTMLElement | undefined;
    if (!li) {
      return undefined;
    }
    const result = this._findLastDescendant(li);
    // either it has more children or we can return the current list
    if (result) {
      return result;
    }
    return li;
  }

  /**
   * Focuses on a first list item that accepts focus relative to the given node.
   * 
   * @param node The node to use as a reference. The current focused node by default.
   * @returns true when focused on any of the parents
   */
  protected _focusFirstParent(node: HTMLElement): boolean {
    if (!node) {
      return false;
    }
    const parent = this._findParentListItem(node);
    if (parent) {
      this.focused = parent;
      return true;
    }
    return false;
  }
}

const instance = new A11yNav();
instance.initialize();
