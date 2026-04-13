/**
 * Nova Framework v2.0.0
 * Type definitions
 */

// ─── Константы ────────────────────────────────────────────────

declare const CLASSES: {
  readonly SHOW:       'show';
  readonly ACTIVE:     'active';
  readonly DISMISSING: 'toast-dismissing';
  readonly SHAKE:      'modal-shake';
};

declare const SELECTORS: {
  readonly MODAL:            '[data-modal]';
  readonly MODAL_TOGGLE:     '[data-modal-toggle]';
  readonly MODAL_CLOSE:      '[data-modal-close]';
  readonly MODAL_DIALOG:     '.modal-dialog';
  readonly DROPDOWN:         '.dropdown';
  readonly DROPDOWN_MENU:    '.dropdown-menu';
  readonly DROPDOWN_ITEM:    '.dropdown-item';
  readonly TABS:             '.tabs';
  readonly TAB_LINK:         '.tab-link';
  readonly TAB_PANE:         '.tab-pane';
  readonly TABS_HEADER:      '.tabs-header';
  readonly COLLAPSE:         '.collapse-item';
  readonly COLLAPSE_HEADER:  '.collapse-header';
  readonly COLLAPSE_BODY:    '.collapse-body';
  readonly CAROUSEL:         '[data-carousel]';
  readonly CAROUSEL_ITEM:    '.carousel-item';
  readonly TOOLTIP:          '[data-tooltip]';
};

declare const ANIMATION_DURATION: {
  readonly TOAST:    300;
  readonly COLLAPSE: 300;
  readonly CAROUSEL: 600;
  readonly SHAKE:    300;
};

// ─── NovaUtils ────────────────────────────────────────────────

export interface NovaUtils {

  isElement(el: unknown): el is Element | HTMLDocument;

  /**
   * XSS-safe escaping для innerHTML-контекста.
   */
  escapeHtml(str: string | number | boolean | null | undefined): string;

  /**
   * XSS-safe escaping для href / data-* / on* атрибутов.
   */
  escapeAttr(str: string | number | boolean | null | undefined): string;

  getParent(el: Element, selector?: string): Element | null;

  addClass(el: Element | null | undefined, ...classes: string[]): void;
  removeClass(el: Element | null | undefined, ...classes: string[]): void;
  toggleClass(el: Element | null | undefined, className: string, force?: boolean): void;
  hasClass(el: Element | null | undefined, className: string): boolean;

  setData(el: HTMLElement | null | undefined, key: string, value: string): void;
  getData(el: HTMLElement | null | undefined, key: string): string | null;

  remove(el: Element | null | undefined): void;
  empty(el: Element | null | undefined): void;
  html(el: Element | null | undefined, html: string): void;
  text(el: Element | null | undefined, text: string): void;

  on(
    el: Element | Element[] | null | undefined,
    event: string,
    callback: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions
  ): void;

  off(
    el: Element | null | undefined,
    event: string,
    callback: EventListenerOrEventListenerObject,
    options?: EventListenerOptions
  ): void;

  trigger(
    el: Element | null | undefined,
    eventName: string,
    detail?: Record<string, unknown>
  ): void;

  delay(ms: number): Promise<void>;

  getStyle(el: Element | null | undefined, prop: string): string | null;
  setStyle(el: HTMLElement | null | undefined, styles: Partial<CSSStyleDeclaration>): void;

  show(el: HTMLElement | null | undefined): void;
  hide(el: HTMLElement | null | undefined): void;
  isVisible(el: HTMLElement | null | undefined): boolean;

  debounce<T extends (...args: unknown[]) => void>(func: T, wait?: number): T;
  throttle<T extends (...args: unknown[]) => void>(func: T, limit?: number): T;

  getRect(el: Element | null | undefined): DOMRect | null;
  isInViewport(el: Element | null | undefined): boolean;

  /**
   * Парсит HTML-строку и возвращает первый дочерний узел.
   * Для гарантированного HTMLElement используй контейнер:
   * `parseHTML('<div><button>...</button></div>')`
   * и обращайся к firstElementChild.
   * @example
   * const node = NovaUtils.parseHTML('<button>Click</button>');
   * if (node instanceof HTMLElement) node.addEventListener('click', fn);
   */
  parseHTML(html: string): ChildNode | null;

  query(selector: string, parent?: Document | Element): Element | null;
  queryAll(selector: string, parent?: Document | Element): Element[];

  prefersReducedMotion(): boolean;

  /**
   * Возвращает 0 если prefers-reduced-motion активен, иначе ms.
   * Используй для JS-анимаций совместно с CSS transition: none.
   */
  animationDuration(ms: number): number;
}

export declare const NovaUtils: NovaUtils;


// ─── NovaDOM ──────────────────────────────────────────────────

export declare class NovaDOM {
  readonly element: HTMLElement | SVGElement | null;

  constructor(selector: string | HTMLElement | SVGElement);

  static query(selector: string): NovaDOM;
  static queryAll(selector: string): NovaDOM[];

  addClass(...classes: string[]): this;
  removeClass(...classes: string[]): this;
  toggleClass(className: string, force?: boolean): this;
  hasClass(className: string): boolean;

  html(): string;
  html(html: string): this;

  text(): string;
  text(text: string): this;

  attr(name: string): string | null;
  attr(name: string, value: string): this;
  removeAttr(name: string): this;

  data(key: string): string | undefined;
  data(key: string, value: string): this;

  /**
   * Getter: возвращает вычисленное значение CSS-свойства.
   * Возвращает '' (пустую строку) если свойство не задано — никогда null.
   */
  style(prop: string): string;
  style(prop: string, value: string): this;
  style(styles: Partial<CSSStyleDeclaration>): this;

  show(): this;
  hide(): this;
  toggle(): this;

  on(event: string, callback: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): this;
  off(event: string, callback: EventListenerOrEventListenerObject, options?: EventListenerOptions): this;
  trigger(eventName: string, detail?: Record<string, unknown>): this;

  parent(selector?: string): NovaDOM | null;
  find(selector: string): NovaDOM | null;
  findAll(selector: string): NovaDOM[];

  get(): HTMLElement | SVGElement | null;
}


// ─── NovaModal ────────────────────────────────────────────────

export interface NovaModalOptions {
  /**
   * true    — клик по backdrop закрывает модал
   * false   — клики по backdrop игнорируются, backdrop не показывается
   * 'static'— backdrop показывается, клик запускает shake-анимацию
   */
  backdrop?: boolean | 'static';
  /** Закрытие по клавише Escape */
  keyboard?: boolean;
}

/** @internal Внутренняя конфигурация с применёнными дефолтами */
export interface NovaModalConfig {
  backdrop: boolean | 'static';
  keyboard: boolean;
}

export declare class NovaModal {
  readonly modal:   HTMLElement;
  readonly options: NovaModalConfig;

  constructor(modalElement: string | HTMLElement, options?: NovaModalOptions);

  static getInstance(el: string | HTMLElement): NovaModal | undefined;
  static getBackdrop(): HTMLElement;

  /**
   * Открывает модальное окно.
   * @fires modal.open
   * @fires nova:modal-open
   */
  open(): void;

  /**
   * Закрывает модальное окно.
   * @fires modal.close
   * @fires nova:modal-close
   */
  close(): void;

  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}


// ─── NovaDropdown ─────────────────────────────────────────────

export declare class NovaDropdown {
  readonly dropdown:  HTMLElement;
  readonly triggerEl: HTMLElement;
  readonly menu:      HTMLElement | null;

  constructor(dropdownElement: string | HTMLElement);

  static getInstance(el: string | HTMLElement): NovaDropdown | undefined;

  /** @fires dropdown.show */
  show(): void;
  /** @fires dropdown.hide */
  hide(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}


// ─── NovaToast ────────────────────────────────────────────────

export type ToastType =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info';

export type ToastPosition =
  | 'top-start'    | 'top-center'    | 'top-end'
  | 'bottom-start' | 'bottom-center' | 'bottom-end';

export interface NovaToastOptions {
  title?:       string;
  type?:        ToastType;
  /** Длительность показа в мс. 0 = бесконечно. @default 3000 */
  duration?:    number;
  position?:    ToastPosition;
  closeButton?: boolean;
  progress?:    boolean;
  /**
   * Разрешить HTML в message.
   * ⚠️ Используй только с доверенным контентом!
   */
  html?:        boolean;
}

/** @internal */
export interface NovaToastConfig {
  title:       string;
  type:        ToastType;
  duration:    number;
  position:    ToastPosition;
  closeButton: boolean;
  progress:    boolean;
  html:        boolean;
}

export declare class NovaToast {
  readonly element:   HTMLElement;
  readonly container: HTMLElement;
  readonly options:   NovaToastConfig;

  constructor(message: string, options?: NovaToastOptions);

  /** Возвращает все активные тосты. */
  static getAll(): NovaToast[];

  /** Закрывает все активные тосты. */
  static closeAll(): void;

  close(): void;
  show():  void;
  hide():  void;
}


// ─── NovaTabs ─────────────────────────────────────────────────

export interface NovaTabsOptions {
  /**
   * Синхронизировать активный таб с URL hash.
   * ⚠️ Отключи для SPA (React Router, Vue Router).
   * @default false
   */
  syncHash?: boolean;
}

/** @internal */
export interface NovaTabsConfig {
  syncHash: boolean;
}

export interface NovaTabShowDetail {
  index: number;
  tab:   HTMLElement;
}

export declare class NovaTabs {
  readonly container: HTMLElement;
  readonly tabs:      HTMLElement[];
  readonly panes:     HTMLElement[];
  readonly options:   NovaTabsConfig;

  constructor(tabsContainer: string | HTMLElement, options?: NovaTabsOptions);

  /**
   * Показывает таб по индексу.
   * @fires tab.show
   */
  show(index: number): void;

  /**
   * Показывает таб по data-tab-id или href (например '#tab-1').
   * @fires tab.show
   */
  show(id: string): void;

  /** @returns Индекс активного таба */
  getActive(): number;

  destroy(): void;
}


// ─── NovaCollapse ─────────────────────────────────────────────

export declare class NovaCollapse {
  readonly element: HTMLElement;
  readonly header:  HTMLElement | null;
  readonly body:    HTMLElement | null;

  constructor(collapseElement: string | HTMLElement);

  /** @fires collapse.open */
  open(): void;
  /** @fires collapse.close */
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}


// ─── NovaCarousel ─────────────────────────────────────────────

export interface NovaCarouselOptions {
  /** Интервал авто-прокрутки в мс. 0 = выключено. @default 5000 */
  interval?: number;
  /** Навигация стрелками клавиатуры. @default true */
  keyboard?: boolean;
  /** Пауза при hover/focus. @default 'hover' */
  pause?:    'hover' | false;
  /** Зацикливание слайдов. @default true */
  wrap?:     boolean;
  /** Поддержка touch/swipe. @default true */
  touch?:    boolean;
}

/** @internal */
export interface NovaCarouselConfig {
  interval: number;
  keyboard: boolean;
  pause:    'hover' | false;
  wrap:     boolean;
  touch:    boolean;
}

export interface NovaCarouselChangeDetail {
  index: number;
}

export declare class NovaCarousel {
  readonly carousel:     HTMLElement;
  readonly slides:       HTMLElement[];
  readonly indicators:   HTMLElement[];
  readonly options:      NovaCarouselConfig;
  readonly currentIndex: number;
  readonly isAnimating:  boolean;

  constructor(carouselElement: string | HTMLElement, options?: NovaCarouselOptions);

  /** @fires carousel.change */
  goTo(index: number): void;
  next():  void;
  prev():  void;
  play():  void;
  pause(): void;

  getCurrentIndex(): number;
  destroy(): void;
}


// ─── NovaTooltip ──────────────────────────────────────────────

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';
export type TooltipTrigger   = 'hover' | 'click' | 'focus';

export interface TooltipDelay {
  show: number;
  hide: number;
}

export interface NovaTooltipOptions {
  title?:     string;
  placement?: TooltipPlacement;
  trigger?:   TooltipTrigger;
  /** Число (одно для show и hide) или объект {show, hide} */
  delay?:     number | TooltipDelay;
  /**
   * Разрешить HTML в title.
   * ⚠️ Используй только с доверенным контентом!
   */
  html?:      boolean;
}

/** @internal */
export interface NovaTooltipConfig {
  title:     string;
  placement: TooltipPlacement;
  trigger:   TooltipTrigger;
  delay:     TooltipDelay;
  html:      boolean;
}

export declare class NovaTooltip {
  readonly element:   HTMLElement;
  readonly options:   NovaTooltipConfig;
  readonly isVisible: boolean;

  constructor(element: string | HTMLElement, options?: NovaTooltipOptions);

  static getInstance(el: string | HTMLElement): NovaTooltip | undefined;

  /** @fires tooltip.show */
  show(): void;
  /** @fires tooltip.hide */
  hide(): void;
  toggle(): void;

  /**
   * Обновляет текст/HTML тултипа без пересоздания элемента.
   */
  setTitle(title: string): void;
  destroy(): void;
}


// ─── Nova Events ──────────────────────────────────────────────

export interface NovaEventMap {
  'nova:ready':        CustomEvent<{ version: string }>;
  'nova:theme-change': CustomEvent<{ theme: 'light' | 'dark' }>;
  'nova:modal-open':   CustomEvent<{ modal: HTMLElement }>;
  'nova:modal-close':  CustomEvent<{ modal: HTMLElement }>;
}

// ─── Nova Plugin ──────────────────────────────────────────────

export interface NovaPlugin {
  install(nova: Nova): void;
}

// ─── Nova Component (union) ───────────────────────────────────

export type AnyNovaComponent =
  | NovaModal
  | NovaDropdown
  | NovaTabs
  | NovaCollapse
  | NovaCarousel
  | NovaTooltip
  | { destroy(): void };

// ─── Nova ─────────────────────────────────────────────────────

export declare class Nova {
  readonly version: string;

  /**
   * Возвращает singleton-экземпляр Nova.
   * Всегда используй этот метод вместо new Nova().
   */
  static getInstance(options?: Record<string, unknown>): Nova;

  /**
   * Получить компонент по DOM-элементу.
   */
  static getComponent(el: string | HTMLElement): AnyNovaComponent | undefined;

  /**
   * Статический dispatch для событий фреймворка.
   * Используется компонентами внутри фреймворка.
   */
  static dispatchFrameworkEvent(eventName: string, detail?: Record<string, unknown>): void;

  /**
   * Реестр всех инициализированных компонентов.
   */
  static readonly registry: WeakMap<HTMLElement, AnyNovaComponent>;

  /**
   * Дождаться завершения инициализации фреймворка.
   */
  ready(): Promise<void>;

  // ── Тема ────────────────────────────────────────────────
  /** @fires nova:theme-change */
  setTheme(theme: 'light' | 'dark'): boolean;
  getTheme(): 'light' | 'dark';
  toggleTheme(): boolean;

  // ── Модалы ──────────────────────────────────────────────
  openModal(el:  string | HTMLElement): void;
  closeModal(el: string | HTMLElement): void;

  // ── Тосты ───────────────────────────────────────────────
  toast(message: string,   options?: NovaToastOptions): NovaToast;
  success(message: string, options?: Omit<NovaToastOptions, 'type'>): NovaToast;
  error(message: string,   options?: Omit<NovaToastOptions, 'type'>): NovaToast;
  warning(message: string, options?: Omit<NovaToastOptions, 'type'>): NovaToast;
  info(message: string,    options?: Omit<NovaToastOptions, 'type'>): NovaToast;

  // ── События ─────────────────────────────────────────────

  /**
   * Подписаться на типизированное событие фреймворка.
   */
  on<K extends keyof NovaEventMap>(
    eventName: K,
    callback: (e: NovaEventMap[K]) => void
  ): this;

  /**
   * Подписаться на произвольное событие.
   */
  on(
    eventName: string,
    callback: EventListenerOrEventListenerObject
  ): this;

  /**
   * Отписаться от типизированного события фреймворка.
   */
  off<K extends keyof NovaEventMap>(
    eventName: K,
    callback: (e: NovaEventMap[K]) => void
  ): this;

  /**
   * Отписаться от произвольного события.
   */
  off(
    eventName: string,
    callback: EventListenerOrEventListenerObject
  ): this;

  trigger(eventName: string, detail?: Record<string, unknown>): void;

  // ── Плагины ─────────────────────────────────────────────
  use(plugin: NovaPlugin): this;

  // ── Реестр компонентов ───────────────────────────────────
  register(name: string, component: AnyNovaComponent & { selector?: string }): this;
  get(name: string): AnyNovaComponent | undefined;

  // ── Динамический контент ─────────────────────────────────
  /**
   * Вручную инициализировать компоненты во фрагменте DOM.
   * Используй для SPA, React/Vue порталов, AJAX-контента.
   */
  initFragment(root: string | HTMLElement): void;

  /**
   * Уничтожить все компоненты во фрагменте DOM.
   */
  destroyFragment(root: string | HTMLElement): void;

  getVersion(): string;
  destroy(): void;
}


// ─── Глобальные расширения ────────────────────────────────────

declare global {

  // Типизация кастомных событий на HTMLElement:
  interface HTMLElementEventMap {
    'modal.open':      Event;
    'modal.close':     Event;
    'dropdown.show':   Event;
    'dropdown.hide':   Event;
    'collapse.open':   Event;
    'collapse.close':  Event;
    'carousel.change': CustomEvent<NovaCarouselChangeDetail>;
    'tab.show':        CustomEvent<NovaTabShowDetail>;
    'tooltip.show':    Event;
    'tooltip.hide':    Event;
  }

  // Типизация событий на document:
  interface DocumentEventMap extends NovaEventMap {}

  // Глобальный доступ через window:
  interface Window {
    Nova:         typeof Nova;
    nova:         Nova;
    NovaUtils:    NovaUtils;
    NovaDOM:      typeof NovaDOM;
    NovaModal:    typeof NovaModal;
    NovaDropdown: typeof NovaDropdown;
    NovaToast:    typeof NovaToast;
    NovaTabs:     typeof NovaTabs;
    NovaCollapse: typeof NovaCollapse;
    NovaCarousel: typeof NovaCarousel;
    NovaTooltip:  typeof NovaTooltip;
  }
}


// ─── Default export ───────────────────────────────────────────

declare const nova: Nova;
export default nova;