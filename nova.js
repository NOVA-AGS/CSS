/**
 * @fileoverview Nova Framework v2.0.0
 * Лёгкий UI-фреймворк без зависимостей.
 *
 * @module nova
 * @version 2.0.0
 * @license MIT
 *
 * @example <caption>ESM</caption>
 * import nova, { NovaModal, NovaToast } from './nova.js';
 * await nova.ready();
 *
 * @example <caption>Script tag</caption>
 * <script src="nova.js"></script>
 * <script>
 *   nova.ready().then(() => {
 *     nova.success('Готово!');
 *   });
 * </script>
 */

'use strict';

// ─── Константы ────────────────────────────────────────────────

/**
 * CSS-классы используемые компонентами фреймворка.
 * Вынесены в константы для избежания опечаток и упрощения рефакторинга.
 *
 * @constant {Readonly<{SHOW:string, ACTIVE:string, DISMISSING:string, SHAKE:string}>}
 */
const CLASSES = Object.freeze({
  SHOW:       'show',
  ACTIVE:     'active',
  DISMISSING: 'toast-dismissing',
  SHAKE:      'modal-shake',
});

/**
 * CSS-селекторы компонентов фреймворка.
 * Используются при авто-инициализации и поиске дочерних элементов.
 *
 * @constant {Readonly<Object.<string, string>>}
 */
const SELECTORS = Object.freeze({
  MODAL:            '[data-modal]',
  MODAL_TOGGLE:     '[data-modal-toggle]',
  MODAL_CLOSE:      '[data-modal-close]',
  MODAL_DIALOG:     '.modal-dialog',
  DROPDOWN:         '.dropdown',
  DROPDOWN_MENU:    '.dropdown-menu',
  DROPDOWN_ITEM:    '.dropdown-item',
  TABS:             '.tabs',
  TAB_LINK:         '.tab-link',
  TAB_PANE:         '.tab-pane',
  TABS_HEADER:      '.tabs-header',
  COLLAPSE:         '.collapse-item',
  COLLAPSE_HEADER:  '.collapse-header',
  COLLAPSE_BODY:    '.collapse-body',
  CAROUSEL:         '[data-carousel]',
  CAROUSEL_ITEM:    '.carousel-item',
  TOOLTIP:          '[data-tooltip]',
});

/**
 * Длительности анимаций в миллисекундах.
 * При активном prefers-reduced-motion используй {@link NovaUtils.animationDuration}.
 *
 * @constant {Readonly<{TOAST:number, COLLAPSE:number, CAROUSEL:number, SHAKE:number}>}
 */
const ANIMATION_DURATION = Object.freeze({
  TOAST:    300,
  COLLAPSE: 300,
  CAROUSEL: 600,
  SHAKE:    300,
});

/**
 * Глобальный счётчик для генерации уникальных ID.
 * @type {number}
 * @private
 */
let _uidCounter = 0;

/**
 * Генерирует уникальный ID с заданным префиксом.
 * Использует инкрементный счётчик — без коллизий в отличие от Date.now().
 *
 * @param {string} [prefix='nova'] - Префикс идентификатора
 * @returns {string} Уникальный ID вида 'nova-42'
 *
 * @example
 * uid('nova-tab');   // 'nova-tab-1'
 * uid('nova-tab');   // 'nova-tab-2'
 * uid('nova-modal'); // 'nova-modal-3'
 */
function uid(prefix = 'nova') {
  return `${prefix}-${++_uidCounter}`;
}


// ─── Делегирование document-событий ──────────────────────────

/**
 * Реестр делегированных обработчиков событий на document.
 * Вместо N отдельных listeners — один на document для каждого типа события.
 *
 * @type {Object.<string, Set<Function>>}
 * @private
 */
const _documentDelegates = {
  click:   new Set(),
  keydown: new Set(),
};

/**
 * Добавляет единственный listener на document для типа события
 * если он ещё не был добавлен (size === 1 после добавления = первый элемент).
 *
 * @param {string} type - Тип события ('click' | 'keydown')
 * @private
 */
function _ensureDocumentListener(type) {
  if (_documentDelegates[type].size === 1) {
    document.addEventListener(type, _documentDelegateHandler.bind(null, type));
  }
}

/**
 * Единый обработчик событий на document.
 * Вызывает все зарегистрированные функции для данного типа события.
 *
 * @param {string} type - Тип события
 * @param {Event}  e    - Объект события
 * @private
 */
function _documentDelegateHandler(type, e) {
  _documentDelegates[type].forEach(fn => fn(e));
}

/**
 * Регистрирует обработчик в делегате document.
 * Автоматически создаёт корневой listener при первом добавлении.
 *
 * @param {string}   type - Тип события ('click' | 'keydown')
 * @param {Function} fn   - Функция-обработчик
 *
 * @example
 * this._handleDocClick = this._onDocumentClick.bind(this);
 * addDocumentHandler('click', this._handleDocClick);
 */
function addDocumentHandler(type, fn) {
  _documentDelegates[type].add(fn);
  _ensureDocumentListener(type);
}

/**
 * Удаляет обработчик из делегата document.
 * Вызывай в методе destroy() компонента.
 *
 * @param {string}   type - Тип события ('click' | 'keydown')
 * @param {Function} fn   - Та же ссылка что передавалась в addDocumentHandler
 *
 * @example
 * removeDocumentHandler('click', this._handleDocClick);
 */
function removeDocumentHandler(type, fn) {
  _documentDelegates[type].delete(fn);
}


// ─── NovaUtils ────────────────────────────────────────────────

/**
 * Коллекция утилитарных методов Nova Framework.
 * Покрывает работу с DOM, событиями, строками, производительностью и доступностью.
 *
 * @namespace NovaUtils
 *
 * @example
 * // XSS-безопасная вставка пользовательских данных:
 * element.innerHTML = `<p>${NovaUtils.escapeHtml(userInput)}</p>`;
 *
 * @example
 * // Debounce для поиска:
 * const search = NovaUtils.debounce(fetchResults, 300);
 * input.addEventListener('input', search);
 */
const NovaUtils = {

  /**
   * Проверяет является ли значение DOM-элементом или документом.
   *
   * @param {unknown} el - Проверяемое значение
   * @returns {boolean}
   *
   * @example
   * NovaUtils.isElement(document.body); // true
   * NovaUtils.isElement('#modal');      // false
   * NovaUtils.isElement(null);          // false
   */
  isElement(el) {
    return el instanceof Element || el instanceof HTMLDocument;
  },

  /**
   * Экранирует строку для безопасной вставки в innerHTML.
   *
   * ⚠️ Безопасно ТОЛЬКО для innerHTML-контекста.
   * Для href / data-* / on* атрибутов используй {@link NovaUtils.escapeAttr}.
   *
   * @param {string|number|boolean|null|undefined} str - Входное значение
   * @returns {string} Экранированная строка
   *
   * @example
   * NovaUtils.escapeHtml('<script>alert(1)</script>');
   * // → '&lt;script&gt;alert(1)&lt;/script&gt;'
   *
   * NovaUtils.escapeHtml(null); // → ''
   * NovaUtils.escapeHtml(42);   // → '42'
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
  },

  /**
   * Экранирует строку для безопасной вставки в HTML-атрибуты.
   * Заменяет символы: & < > " '
   *
   * @param {string|number|boolean|null|undefined} str - Входное значение
   * @returns {string} Экранированная строка
   *
   * @example
   * element.setAttribute('data-title', NovaUtils.escapeAttr(userInput));
   * NovaUtils.escapeAttr('"hello"'); // → '&quot;hello&quot;'
   * NovaUtils.escapeAttr(null);      // → ''
   */
  escapeAttr(str) {
    return String(str ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[m] ?? m);
  },

  /**
   * Возвращает ближайшего предка элемента.
   * Без селектора — прямой родитель.
   * С селектором — поднимается по дереву до первого совпадения.
   *
   * @param {Element} el         - Исходный элемент
   * @param {string}  [selector] - CSS-селектор предка
   * @returns {Element|null}
   *
   * @example
   * NovaUtils.getParent(button, '.card'); // ближайший .card
   * NovaUtils.getParent(input, 'form');   // ближайшая форма
   */
  getParent(el, selector) {
    if (!selector) return el.parentElement;
    let parent = el.parentElement;
    while (parent) {
      if (parent.matches(selector)) return parent;
      parent = parent.parentElement;
    }
    return null;
  },

  /**
   * Добавляет CSS-классы элементу. Безопасен при null/undefined.
   *
   * @param {Element|null|undefined} el      - Целевой элемент
   * @param {...string}              classes  - Классы для добавления
   *
   * @example
   * NovaUtils.addClass(modal, 'show', 'fade');
   */
  addClass(el, ...classes) { el?.classList.add(...classes); },

  /**
   * Удаляет CSS-классы у элемента. Безопасен при null/undefined.
   *
   * @param {Element|null|undefined} el      - Целевой элемент
   * @param {...string}              classes  - Классы для удаления
   */
  removeClass(el, ...classes) { el?.classList.remove(...classes); },

  /**
   * Переключает CSS-класс элемента.
   *
   * @param {Element|null|undefined} el        - Целевой элемент
   * @param {string}                 className  - Класс для переключения
   * @param {boolean}                [force]    - true = добавить, false = удалить
   */
  toggleClass(el, className, force) { el?.classList.toggle(className, force); },

  /**
   * Проверяет наличие CSS-класса. Возвращает false при null/undefined.
   *
   * @param {Element|null|undefined} el        - Целевой элемент
   * @param {string}                 className  - Проверяемый класс
   * @returns {boolean}
   */
  hasClass(el, className) { return el?.classList.contains(className) ?? false; },

  /**
   * Устанавливает data-атрибут элемента.
   *
   * @param {HTMLElement|null|undefined} el    - Целевой элемент
   * @param {string}                     key   - Ключ в camelCase
   * @param {string}                     value - Значение
   *
   * @example
   * NovaUtils.setData(el, 'modalId', '123'); // → data-modal-id="123"
   */
  setData(el, key, value) { if (el) el.dataset[key] = value; },

  /**
   * Читает data-атрибут элемента. Возвращает null если элемент не передан.
   *
   * @param {HTMLElement|null|undefined} el  - Целевой элемент
   * @param {string}                     key - Ключ в camelCase
   * @returns {string|null}
   */
  getData(el, key) { return el?.dataset[key] ?? null; },

  /**
   * Удаляет элемент из DOM. Безопасен при null/undefined.
   * @param {Element|null|undefined} el
   */
  remove(el) { el?.remove(); },

  /**
   * Очищает содержимое элемента (innerHTML = '').
   * @param {Element|null|undefined} el
   */
  empty(el) { if (el) el.innerHTML = ''; },

  /**
   * Устанавливает HTML-содержимое элемента.
   * ⚠️ Используй только с доверенным или предварительно экранированным контентом.
   *
   * @param {Element|null|undefined} el   - Целевой элемент
   * @param {string}                 html - HTML-строка
   */
  html(el, html) { if (el) el.innerHTML = html; },

  /**
   * Устанавливает текстовое содержимое. XSS-безопасно.
   *
   * @param {Element|null|undefined} el   - Целевой элемент
   * @param {string}                 text - Текст
   *
   * @example
   * NovaUtils.text(title, userInput); // безопасно для пользовательских данных
   */
  text(el, text) { if (el) el.textContent = text; },

  /**
   * Добавляет обработчик события на элемент или массив элементов.
   *
   * @param {Element|Element[]|null|undefined}      el       - Элемент или массив
   * @param {string}                                event    - Имя события
   * @param {EventListenerOrEventListenerObject}     callback - Обработчик
   * @param {AddEventListenerOptions}               [options] - Опции
   *
   * @example
   * NovaUtils.on(btn, 'click', handleClick);
   * NovaUtils.on([btn1, btn2], 'click', handleClick);
   * NovaUtils.on(el, 'scroll', handler, { passive: true });
   */
  on(el, event, callback, options) {
    if (!el) return;
    const targets = Array.isArray(el) ? el : [el];
    targets.forEach(e => e.addEventListener(event, callback, options));
  },

  /**
   * Удаляет обработчик события. Передай ту же ссылку что и при on().
   *
   * @param {Element|null|undefined}             el       - Целевой элемент
   * @param {string}                             event    - Имя события
   * @param {EventListenerOrEventListenerObject}  callback - Обработчик
   * @param {EventListenerOptions}               [options]
   */
  off(el, event, callback, options) {
    el?.removeEventListener(event, callback, options);
  },

  /**
   * Создаёт и диспатчит CustomEvent на элементе (bubbles: true).
   *
   * @param {Element|null|undefined} el        - Целевой элемент
   * @param {string}                 eventName - Имя события
   * @param {object}                 [detail]  - Данные события
   *
   * @example
   * NovaUtils.trigger(modal, 'modal.open', { id: 'main-modal' });
   */
  trigger(el, eventName, detail = {}) {
    el?.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
  },

  /**
   * Возвращает Promise который resolves через указанное число мс.
   *
   * @param {number} ms - Задержка в миллисекундах
   * @returns {Promise<void>}
   *
   * @example
   * await NovaUtils.delay(300);
   * element.classList.remove('fade-in');
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Возвращает вычисленное значение CSS-свойства элемента.
   *
   * @param {Element|null|undefined} el   - Целевой элемент
   * @param {string}                 prop - CSS-свойство в kebab-case
   * @returns {string|null} Значение или null если el не передан
   *
   * @example
   * NovaUtils.getStyle(el, 'background-color'); // 'rgb(255, 255, 255)'
   * NovaUtils.getStyle(el, '--nova-gap');        // значение CSS-переменной
   */
  getStyle(el, prop) {
    if (!el) return null;
    return window.getComputedStyle(el).getPropertyValue(prop);
  },

  /**
   * Применяет несколько inline-стилей за один вызов.
   *
   * @param {HTMLElement|null|undefined}   el     - Целевой элемент
   * @param {Partial<CSSStyleDeclaration>} styles - Объект стилей
   *
   * @example
   * NovaUtils.setStyle(tooltip, { position: 'fixed', top: '100px' });
   */
  setStyle(el, styles) {
    if (!el) return;
    Object.assign(el.style, styles);
  },

  /**
   * Показывает элемент сбрасывая display: none.
   * @param {HTMLElement|null|undefined} el
   */
  show(el) { if (el) el.style.display = ''; },

  /**
   * Скрывает элемент через display: none.
   * @param {HTMLElement|null|undefined} el
   */
  hide(el) { if (el) el.style.display = 'none'; },

  /**
   * Проверяет виден ли элемент (имеет offsetParent).
   *
   * @param {HTMLElement|null|undefined} el
   * @returns {boolean}
   */
  isVisible(el) { return el?.offsetParent !== null ?? false; },

  /**
   * Возвращает debounce-обёртку функции.
   * Вызов откладывается на wait мс после последнего вызова.
   *
   * @param {Function} func       - Исходная функция
   * @param {number}   [wait=300] - Задержка в мс
   * @returns {Function}
   *
   * @example
   * const onResize = NovaUtils.debounce(() => recalcLayout(), 200);
   * window.addEventListener('resize', onResize);
   */
  debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  /**
   * Возвращает throttle-обёртку функции.
   * Функция вызывается не чаще одного раза за limit мс.
   *
   * @param {Function} func        - Исходная функция
   * @param {number}   [limit=300] - Минимальный интервал в мс
   * @returns {Function}
   *
   * @example
   * const onScroll = NovaUtils.throttle(() => updateHeader(), 100);
   * window.addEventListener('scroll', onScroll, { passive: true });
   */
  throttle(func, limit = 300) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  /**
   * Возвращает DOMRect элемента (размеры и позицию).
   *
   * @param {Element|null|undefined} el
   * @returns {DOMRect|null}
   *
   * @example
   * const rect = NovaUtils.getRect(btn);
   * console.log(rect.top, rect.width);
   */
  getRect(el) { return el?.getBoundingClientRect() ?? null; },

  /**
   * Проверяет находится ли элемент в области видимости viewport.
   * Считается видимым если хотя бы частично пересекается с экраном.
   *
   * @param {Element|null|undefined} el
   * @returns {boolean}
   *
   * @example
   * if (NovaUtils.isInViewport(section)) {
   *   section.classList.add('animate');
   * }
   */
  isInViewport(el) {
    const rect = this.getRect(el);
    if (!rect) return false;
    return (
      rect.top    < window.innerHeight &&
      rect.bottom > 0 &&
      rect.left   < window.innerWidth &&
      rect.right  > 0
    );
  },

  /**
   * Парсит HTML-строку и возвращает первый дочерний узел.
   *
   * ⚠️ Возвращает ChildNode (может быть Text, Comment, Element).
   * Для гарантированного HTMLElement оберни в контейнер.
   *
   * @param {string} html - HTML-строка
   * @returns {ChildNode|null}
   *
   * @example
   * const btn = NovaUtils.parseHTML('<button class="btn">Click</button>');
   * if (btn instanceof HTMLElement) {
   *   document.body.appendChild(btn);
   * }
   */
  parseHTML(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  },

  /**
   * Находит первый элемент по CSS-селектору.
   *
   * @param {string}           selector        - CSS-селектор
   * @param {Document|Element} [parent=document] - Контекст поиска
   * @returns {Element|null}
   *
   * @example
   * NovaUtils.query('.modal');
   * NovaUtils.query('.item', listElement);
   */
  query(selector, parent = document) { return parent.querySelector(selector); },

  /**
   * Находит все элементы по CSS-селектору. Возвращает Array (не NodeList).
   *
   * @param {string}           selector          - CSS-селектор
   * @param {Document|Element} [parent=document] - Контекст поиска
   * @returns {Element[]}
   *
   * @example
   * NovaUtils.queryAll('.tab-link').forEach(tab => tab.setAttribute('tabindex', '-1'));
   */
  queryAll(selector, parent = document) { return Array.from(parent.querySelectorAll(selector)); },

  /**
   * Проверяет системную настройку prefers-reduced-motion.
   * Используй для отключения анимаций у пользователей с вестибулярными нарушениями.
   *
   * @returns {boolean} true если пользователь предпочитает минимум анимаций
   *
   * @example
   * if (NovaUtils.prefersReducedMotion()) {
   *   element.style.transition = 'none';
   * }
   */
  prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  /**
   * Возвращает длительность анимации с учётом prefers-reduced-motion.
   * При активной настройке возвращает 0 — анимация мгновенная.
   *
   * @param {number} ms - Желаемая длительность в мс
   * @returns {number} ms или 0
   *
   * @example
   * const duration = NovaUtils.animationDuration(300);
   * element.style.transition = duration > 0
   *   ? `opacity ${duration}ms ease`
   *   : 'none';
   */
  animationDuration(ms) {
    return this.prefersReducedMotion() ? 0 : ms;
  },
};


// ─── NovaDOM ──────────────────────────────────────────────────

/**
 * Лёгкая jQuery-подобная обёртка над HTMLElement с chainable API.
 * Все методы (кроме геттеров) возвращают this для цепочек вызовов.
 *
 * @class NovaDOM
 *
 * @example <caption>Базовое использование</caption>
 * NovaDOM.query('.modal')
 *   .addClass('show')
 *   .attr('aria-hidden', 'false')
 *   .on('click', handleClick);
 *
 * @example <caption>Множественные элементы</caption>
 * NovaDOM.queryAll('.tab-link').forEach(tab => {
 *   tab.addClass('initialized');
 * });
 */
class NovaDOM {

  /**
   * @param {string|HTMLElement|SVGElement} selector - Элемент или CSS-селектор
   */
  constructor(selector) {
    if (selector instanceof HTMLElement || selector instanceof SVGElement) {
      this.element = selector;
    } else if (typeof selector === 'string') {
      this.element = document.querySelector(selector);
    } else {
      this.element = null;
    }
  }

  /**
   * Создаёт NovaDOM для первого совпадающего элемента.
   *
   * @param {string} selector - CSS-селектор
   * @returns {NovaDOM}
   *
   * @example
   * const modal = NovaDOM.query('#main-modal');
   */
  static query(selector) { return new NovaDOM(selector); }

  /**
   * Создаёт массив NovaDOM для всех совпадающих элементов.
   *
   * @param {string} selector - CSS-селектор
   * @returns {NovaDOM[]}
   *
   * @example
   * NovaDOM.queryAll('.dropdown').forEach(d => d.addClass('ready'));
   */
  static queryAll(selector) {
    return Array.from(document.querySelectorAll(selector)).map(el => new NovaDOM(el));
  }

  /**
   * Добавляет CSS-классы.
   * @param {...string} classes
   * @returns {this}
   */
  addClass(...classes) { this.element?.classList.add(...classes); return this; }

  /**
   * Удаляет CSS-классы.
   * @param {...string} classes
   * @returns {this}
   */
  removeClass(...classes) { this.element?.classList.remove(...classes); return this; }

  /**
   * Переключает CSS-класс.
   * @param {string}  className
   * @param {boolean} [force]
   * @returns {this}
   */
  toggleClass(className, force) { this.element?.classList.toggle(className, force); return this; }

  /**
   * Проверяет наличие CSS-класса.
   * @param {string} className
   * @returns {boolean}
   */
  hasClass(className) { return this.element?.classList.contains(className) ?? false; }

  /**
   * Геттер/сеттер HTML-содержимого.
   * Без аргумента — читает innerHTML.
   * С аргументом — устанавливает и возвращает this.
   *
   * @param {string|null} [html=null]
   * @returns {string|this}
   *
   * @example
   * const content = el.html();
   * el.html('<p>Hello</p>').addClass('loaded');
   */
  html(html = null) {
    if (!this.element) return html === null ? '' : this;
    if (html === null) return this.element.innerHTML;
    this.element.innerHTML = html;
    return this;
  }

  /**
   * Геттер/сеттер текстового содержимого. XSS-безопасен.
   *
   * @param {string|null} [text=null]
   * @returns {string|this}
   *
   * @example
   * const label = btn.text();
   * btn.text('Сохранить');
   */
  text(text = null) {
    if (!this.element) return text === null ? '' : this;
    if (text === null) return this.element.textContent;
    this.element.textContent = text;
    return this;
  }

  /**
   * Геттер/сеттер HTML-атрибута.
   *
   * @param {string}      name
   * @param {string|null} [value=null]
   * @returns {string|null|this}
   *
   * @example
   * el.attr('aria-label');           // геттер → string|null
   * el.attr('aria-label', 'Close');  // сеттер → this
   */
  attr(name, value = null) {
    if (!this.element) return value === null ? null : this;
    if (value === null) return this.element.getAttribute(name);
    this.element.setAttribute(name, value);
    return this;
  }

  /**
   * Удаляет HTML-атрибут.
   * @param {string} name
   * @returns {this}
   */
  removeAttr(name) { this.element?.removeAttribute(name); return this; }

  /**
   * Геттер/сеттер data-атрибута.
   *
   * @param {string}      key
   * @param {string|null} [value=null]
   * @returns {string|undefined|this}
   *
   * @example
   * el.data('modalId');       // читает data-modal-id
   * el.data('modalId', '42'); // устанавливает data-modal-id="42"
   */
  data(key, value = null) {
    if (!this.element) return value === null ? null : this;
    if (value === null) return this.element.dataset[key];
    this.element.dataset[key] = value;
    return this;
  }

  /**
   * Геттер/сеттер CSS-стилей.
   * Getter возвращает '' (пустую строку) если свойство не задано — никогда null.
   *
   * @param {string|Partial<CSSStyleDeclaration>} prop
   * @param {string|null} [value=null]
   * @returns {string|this}
   *
   * @example
   * el.style('color');                         // геттер → 'rgb(0,0,0)'
   * el.style('color', 'red');                  // сеттер
   * el.style({ color: 'red', opacity: '0' });  // объект стилей
   */
  style(prop, value = null) {
    if (!this.element) return value === null ? null : this;
    if (value === null) {
      return typeof prop === 'object'
        ? this
        : window.getComputedStyle(this.element).getPropertyValue(prop);
    }
    if (typeof prop === 'object') {
      Object.assign(this.element.style, prop);
    } else {
      this.element.style[prop] = value;
    }
    return this;
  }

  /**
   * Показывает элемент (сбрасывает display: none).
   * @returns {this}
   */
  show() { if (this.element) this.element.style.display = ''; return this; }

  /**
   * Скрывает элемент (display: none).
   * @returns {this}
   */
  hide() { if (this.element) this.element.style.display = 'none'; return this; }

  /**
   * Переключает видимость элемента.
   * @returns {this}
   */
  toggle() { return this.element?.style.display === 'none' ? this.show() : this.hide(); }

  /**
   * Добавляет обработчик события.
   *
   * @param {string}                             event    - Имя события
   * @param {EventListenerOrEventListenerObject}  callback - Обработчик
   * @param {AddEventListenerOptions}            [options]
   * @returns {this}
   *
   * @example
   * el.on('click', handleClick).on('keydown', handleKey);
   */
  on(event, callback, options) { this.element?.addEventListener(event, callback, options); return this; }

  /**
   * Удаляет обработчик события.
   *
   * @param {string}                             event    - Имя события
   * @param {EventListenerOrEventListenerObject}  callback - Тот же обработчик
   * @param {EventListenerOptions}               [options]
   * @returns {this}
   */
  off(event, callback, options) { this.element?.removeEventListener(event, callback, options); return this; }

  /**
   * Диспатчит CustomEvent на элементе.
   *
   * @param {string} eventName   - Имя события
   * @param {object} [detail={}] - Данные события
   * @returns {this}
   *
   * @example
   * el.trigger('tab.show', { index: 2 });
   */
  trigger(eventName, detail = {}) {
    this.element?.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
    return this;
  }

  /**
   * Возвращает NovaDOM для родительского элемента.
   * С селектором — поднимается до первого совпадения.
   *
   * @param {string|null} [selector=null]
   * @returns {NovaDOM|null}
   *
   * @example
   * btn.parent();        // прямой родитель
   * btn.parent('.card'); // ближайший .card
   */
  parent(selector = null) {
    if (!this.element) return null;
    if (!selector) return new NovaDOM(this.element.parentElement);
    let parent = this.element.parentElement;
    while (parent) {
      if (parent.matches(selector)) return new NovaDOM(parent);
      parent = parent.parentElement;
    }
    return null;
  }

  /**
   * Ищет первый дочерний элемент по селектору.
   *
   * @param {string} selector
   * @returns {NovaDOM|null}
   *
   * @example
   * modal.find('.modal-body').html('<p>Content</p>');
   */
  find(selector) {
    return this.element ? new NovaDOM(this.element.querySelector(selector)) : null;
  }

  /**
   * Ищет все дочерние элементы по селектору.
   *
   * @param {string} selector
   * @returns {NovaDOM[]}
   *
   * @example
   * tabs.findAll('.tab-link').forEach(tab => tab.attr('tabindex', '-1'));
   */
  findAll(selector) {
    return this.element
      ? Array.from(this.element.querySelectorAll(selector)).map(el => new NovaDOM(el))
      : [];
  }

  /**
   * Возвращает нативный DOM-элемент.
   *
   * @returns {HTMLElement|SVGElement|null}
   *
   * @example
   * const nativeEl = NovaDOM.query('.modal').get();
   * nativeEl?.focus();
   */
  get() { return this.element; }
}


// ─── NovaModal ────────────────────────────────────────────────

/**
 * Компонент модального окна с полной поддержкой доступности.
 *
 * Функции:
 * - Trap фокуса (WAI-ARIA Dialog Pattern)
 * - Возврат фокуса на триггер при закрытии
 * - Компенсация сдвига при скроллбаре
 * - Статический backdrop с shake-анимацией
 * - Синглтон-инстанс на элемент через WeakMap
 *
 * @class NovaModal
 *
 * @example <caption>HTML</caption>
 * <div data-modal id="my-modal">
 *   <div class="modal-dialog">
 *     <div class="modal-header">
 *       <h2 class="modal-header-title">Заголовок</h2>
 *       <button data-modal-close aria-label="Закрыть">&times;</button>
 *     </div>
 *     <div class="modal-body">Содержимое</div>
 *   </div>
 * </div>
 * <button data-modal-toggle="#my-modal">Открыть</button>
 *
 * @example <caption>JS</caption>
 * const modal = new NovaModal('#my-modal', { backdrop: 'static' });
 * modal.open();
 *
 * nova.openModal('#my-modal');
 *
 * @example <caption>События</caption>
 * document.querySelector('#my-modal').addEventListener('modal.open', () => {
 *   console.log('Модал открыт');
 * });
 */
class NovaModal {

  /** @type {HTMLElement|null} @private */
  static #backdrop = null;

  /** @type {number} @private */
  static #activeCount = 0;

  /** @type {WeakMap<HTMLElement, NovaModal>} @private */
  static #instances = new WeakMap();

  /**
   * Возвращает или создаёт глобальный backdrop-элемент (синглтон).
   * @returns {HTMLElement}
   */
  static getBackdrop() {
    if (!NovaModal.#backdrop) {
      NovaModal.#backdrop = document.createElement('div');
      NovaModal.#backdrop.className = 'nova modal-backdrop';
      NovaModal.#backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(NovaModal.#backdrop);
    }
    return NovaModal.#backdrop;
  }

  /**
   * Возвращает существующий экземпляр NovaModal для элемента.
   *
   * @param {string|HTMLElement} el - Элемент или CSS-селектор
   * @returns {NovaModal|undefined}
   *
   * @example
   * const modal = NovaModal.getInstance('#my-modal');
   * modal?.close();
   */
  static getInstance(el) {
    const element = typeof el === 'string' ? document.querySelector(el) : el;
    return NovaModal.#instances.get(element);
  }

  /**
   * Создаёт экземпляр NovaModal.
   * Если экземпляр для элемента уже существует — возвращает его.
   *
   * @param {string|HTMLElement} modalElement - Модал или CSS-селектор
   * @param {object}             [options]
   * @param {boolean|'static'}   [options.backdrop=true]
   *   true    — клик по backdrop закрывает модал
   *   false   — backdrop не показывается
   *   'static'— backdrop виден, клик запускает shake-анимацию
   * @param {boolean} [options.keyboard=true] - Закрытие по Escape
   */
  constructor(modalElement, options = {}) {
    this.modal = typeof modalElement === 'string'
      ? document.querySelector(modalElement)
      : modalElement;

    if (!this.modal || !this.modal.isConnected) {
      console.warn('[NovaModal] Element not found or not connected to DOM:', modalElement);
      return;
    }

    if (NovaModal.#instances.has(this.modal)) {
      return NovaModal.#instances.get(this.modal);
    }

    this.options = {
      backdrop: true,
      keyboard: true,
      ...options,
    };

    this.backdrop = NovaModal.getBackdrop();
    this.closeBtn = this.modal.querySelector(SELECTORS.MODAL_CLOSE);
    this._previouslyFocused = null;

    this._onKeyDown       = this._handleKeyDown.bind(this);
    this._onBackdropClick = this._handleBackdropClick.bind(this);

    this._init();
    NovaModal.#instances.set(this.modal, this);
  }

  /** @private */
  _init() {
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');

    if (
      !this.modal.hasAttribute('aria-labelledby') &&
      !this.modal.hasAttribute('aria-label')
    ) {
      const title = this.modal.querySelector('.modal-header-title, h1, h2, h3');
      if (title) {
        if (!title.id) title.id = uid('nova-modal-title');
        this.modal.setAttribute('aria-labelledby', title.id);
      }
    }

    this.closeBtn?.addEventListener('click', () => this.close());

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this._handleBackdropClick();
    });
  }

  /**
   * Обрабатывает клик по backdrop-области.
   * При backdrop: 'static' — запускает shake-анимацию диалога.
   * @private
   */
  _handleBackdropClick() {
    if (this.options.backdrop === 'static') {
      const dialog = this.modal.querySelector(SELECTORS.MODAL_DIALOG);
      dialog?.classList.add(CLASSES.SHAKE);
      setTimeout(
        () => dialog?.classList.remove(CLASSES.SHAKE),
        ANIMATION_DURATION.SHAKE
      );
      return;
    }
    if (this.options.backdrop) this.close();
  }

  /**
   * Обрабатывает нажатия клавиш.
   * Escape — закрывает с stopPropagation.
   * Tab — передаёт trap-фокусу.
   * @private
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    if (e.key === 'Escape' && this.options.keyboard) {
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key === 'Tab') this._trapFocus(e);
  }

  /**
   * Реализует trap фокуса внутри модала (WAI-ARIA Dialog Pattern).
   * При Tab/Shift+Tab фокус циклически перемещается между интерактивными элементами.
   * @private
   * @param {KeyboardEvent} e
   */
  _trapFocus(e) {
    const focusable = Array.from(
      this.modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), ' +
        'select:not([disabled]), textarea:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.getAttribute('aria-hidden'));

    if (!focusable.length) { e.preventDefault(); return; }

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (!this.modal.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
      return;
    }

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /**
   * Открывает модальное окно.
   * Сохраняет фокус, блокирует скролл body, компенсирует ширину скроллбара.
   * Ничего не делает если модал уже открыт.
   *
   * @fires {Event} modal.open - На элементе модала
   * @fires {CustomEvent} nova:modal-open - На document (detail: { modal })
   *
   * @example
   * NovaModal.getInstance('#my-modal')?.open();
   */
  open() {
    if (this.isOpen()) return;

    this._previouslyFocused = document.activeElement;

    this.modal.classList.add(CLASSES.SHOW);
    this.backdrop.classList.add(CLASSES.SHOW);
    document.body.style.overflow = 'hidden';

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingInlineEnd = `${scrollbarWidth}px`;

    NovaModal.#activeCount++;

    document.addEventListener('keydown', this._onKeyDown);
    this.backdrop.addEventListener('click', this._onBackdropClick);

    requestAnimationFrame(() => {
      const focusTarget = this.modal.querySelector(
        '[autofocus], .modal-header-close, button:not([disabled]), [href], input:not([disabled])'
      );
      focusTarget?.focus();
    });

    this.modal.dispatchEvent(new Event('modal.open'));
    Nova.dispatchFrameworkEvent('modal-open', { modal: this.modal });
  }

  /**
   * Закрывает модальное окно.
   * Восстанавливает скролл и фокус. Ничего не делает если модал закрыт.
   *
   * @fires {Event} modal.close - На элементе модала
   * @fires {CustomEvent} nova:modal-close - На document (detail: { modal })
   *
   * @example
   * NovaModal.getInstance('#my-modal')?.close();
   */
  close() {
    if (!this.isOpen()) return;

    this.modal.classList.remove(CLASSES.SHOW);
    NovaModal.#activeCount--;

    document.removeEventListener('keydown', this._onKeyDown);
    this.backdrop.removeEventListener('click', this._onBackdropClick);

    if (NovaModal.#activeCount === 0) {
      this.backdrop.classList.remove(CLASSES.SHOW);
      document.body.style.overflow         = '';
      document.body.style.paddingInlineEnd = '';
    }

    this._previouslyFocused?.focus();

    this.modal.dispatchEvent(new Event('modal.close'));
    Nova.dispatchFrameworkEvent('modal-close', { modal: this.modal });
  }

  /**
   * Переключает состояние модала (открыт ↔ закрыт).
   * @example
   * btn.addEventListener('click', () => modal.toggle());
   */
  toggle() { this.isOpen() ? this.close() : this.open(); }

  /**
   * @returns {boolean} true если модал открыт
   */
  isOpen() { return this.modal?.classList.contains(CLASSES.SHOW) ?? false; }

  /**
   * Закрывает модал и удаляет экземпляр из реестра.
   */
  destroy() {
    this.close();
    NovaModal.#instances.delete(this.modal);
  }
}


// ─── NovaDropdown ─────────────────────────────────────────────

/**
 * Компонент выпадающего меню с клавиатурной навигацией.
 *
 * Функции:
 * - Навигация стрелками ArrowUp/ArrowDown по пунктам
 * - Закрытие по Escape с возвратом фокуса на триггер
 * - Автозакрытие при клике вне компонента
 * - Закрытие других дропдаунов при открытии нового
 * - Самоочистка при удалении элемента из DOM
 * - Делегированные document listeners (один на все дропдауны)
 *
 * @class NovaDropdown
 *
 * @example <caption>HTML</caption>
 * <div class="dropdown">
 *   <button class="dropdown-toggle" data-dropdown-toggle>Меню ▾</button>
 *   <ul class="dropdown-menu">
 *     <li><a class="dropdown-item" href="#">Пункт 1</a></li>
 *     <li><a class="dropdown-item" href="#">Пункт 2</a></li>
 *   </ul>
 * </div>
 *
 * @example <caption>JS</caption>
 * const dropdown = new NovaDropdown('.dropdown');
 * dropdown.show();
 *
 * document.querySelector('.dropdown').addEventListener('dropdown.show', () => {
 *   console.log('Открылся');
 * });
 */
class NovaDropdown {

  /** @type {WeakMap<HTMLElement, NovaDropdown>} @private */
  static #instances = new WeakMap();

  /**
   * Возвращает существующий экземпляр NovaDropdown.
   *
   * @param {string|HTMLElement} el
   * @returns {NovaDropdown|undefined}
   */
  static getInstance(el) {
    const element = typeof el === 'string' ? document.querySelector(el) : el;
    return NovaDropdown.#instances.get(element);
  }

  /**
   * Создаёт экземпляр NovaDropdown.
   * @param {string|HTMLElement} dropdownElement - Корневой элемент .dropdown
   */
  constructor(dropdownElement) {
    this.dropdown = typeof dropdownElement === 'string'
      ? document.querySelector(dropdownElement)
      : dropdownElement;

    if (!this.dropdown || !this.dropdown.isConnected) {
      console.warn('[NovaDropdown] Element not found or not connected to DOM');
      return;
    }

    if (NovaDropdown.#instances.has(this.dropdown)) {
      return NovaDropdown.#instances.get(this.dropdown);
    }

    this.triggerEl = this.dropdown.querySelector('[data-dropdown-toggle]')
                  || this.dropdown.querySelector('.dropdown-toggle')
                  || this.dropdown;

    this.menu = this.dropdown.querySelector(SELECTORS.DROPDOWN_MENU);

    this._handleTrigger  = this._onTriggerClick.bind(this);
    this._handleDocClick = this._onDocumentClick.bind(this);
    this._handleKeyDown  = this._onKeyDown.bind(this);

    this._init();
    NovaDropdown.#instances.set(this.dropdown, this);
  }

  /** @private */
  _init() {
    this.triggerEl.setAttribute('aria-haspopup', 'true');
    this.triggerEl.setAttribute('aria-expanded', 'false');

    if (this.menu) {
      if (!this.menu.id) this.menu.id = uid('nova-dropdown');
      this.triggerEl.setAttribute('aria-controls', this.menu.id);
      this.menu.setAttribute('role', 'menu');
    }

    this.triggerEl.addEventListener('click', this._handleTrigger);

    this.menu?.querySelectorAll(SELECTORS.DROPDOWN_ITEM).forEach(item => {
      item.setAttribute('role', 'menuitem');
      item.addEventListener('click', () => this.hide());
    });

    addDocumentHandler('click',   this._handleDocClick);
    addDocumentHandler('keydown', this._handleKeyDown);
  }

  /** @private */
  _onTriggerClick(e) {
    e.preventDefault();
    e.stopPropagation();
    this.toggle();
  }

  /**
   * Обрабатывает клики вне компонента.
   * При удалении из DOM — вызывает destroy() для самоочистки.
   * @private
   * @param {MouseEvent} e
   */
  _onDocumentClick(e) {
    if (!this.dropdown.isConnected) { this.destroy(); return; }
    if (!this.dropdown.contains(e.target)) this.hide();
  }

  /**
   * Клавиатурная навигация (WAI-ARIA Menu Button Pattern).
   * @private
   * @param {KeyboardEvent} e
   */
  _onKeyDown(e) {
    if (!this.isOpen() || !this.menu) return;

    switch (e.key) {
      case 'Escape':
        this.hide();
        this.triggerEl.focus();
        break;

      case 'ArrowDown': {
        e.preventDefault();
        const items = this._getFocusableItems();
        const idx   = items.indexOf(document.activeElement);
        const next  = idx < 0 ? 0 : Math.min(idx + 1, items.length - 1);
        items[next]?.focus();
        break;
      }

      case 'ArrowUp': {
        e.preventDefault();
        const items = this._getFocusableItems();
        const idx   = items.indexOf(document.activeElement);
        if (idx <= 0) this.triggerEl.focus();
        else items[idx - 1]?.focus();
        break;
      }

      case 'Home':
        e.preventDefault();
        this._getFocusableItems()[0]?.focus();
        break;

      case 'End': {
        e.preventDefault();
        const items = this._getFocusableItems();
        items[items.length - 1]?.focus();
        break;
      }
    }
  }

  /**
   * Возвращает доступные для фокуса пункты меню.
   * Исключает disabled и aria-disabled элементы.
   * @private
   * @returns {HTMLElement[]}
   */
  _getFocusableItems() {
    return Array.from(
      this.menu?.querySelectorAll(
        `${SELECTORS.DROPDOWN_ITEM}:not([disabled]):not([aria-disabled="true"])`
      ) ?? []
    );
  }

  /**
   * Открывает дропдаун. Закрывает другие открытые дропдауны.
   * @fires {Event} dropdown.show
   */
  show() {
    if (this.isOpen()) return;

    document.querySelectorAll(`${SELECTORS.DROPDOWN}.${CLASSES.SHOW}`).forEach(d => {
      if (d !== this.dropdown) NovaDropdown.getInstance(d)?.hide();
    });

    this.dropdown.classList.add(CLASSES.SHOW);
    this.triggerEl.setAttribute('aria-expanded', 'true');
    this.dropdown.dispatchEvent(new Event('dropdown.show'));

    requestAnimationFrame(() => {
      this._getFocusableItems()[0]?.focus();
    });
  }

  /**
   * Закрывает дропдаун.
   * @fires {Event} dropdown.hide
   */
  hide() {
    if (!this.isOpen()) return;
    this.dropdown.classList.remove(CLASSES.SHOW);
    this.triggerEl.setAttribute('aria-expanded', 'false');
    this.dropdown.dispatchEvent(new Event('dropdown.hide'));
  }

  /** Переключает состояние дропдауна. */
  toggle() { this.isOpen() ? this.hide() : this.show(); }

  /** @returns {boolean} */
  isOpen() { return this.dropdown?.classList.contains(CLASSES.SHOW) ?? false; }

  /** Закрывает, удаляет обработчики и экземпляр из реестра. */
  destroy() {
    this.hide();
    this.triggerEl.removeEventListener('click', this._handleTrigger);
    removeDocumentHandler('click',   this._handleDocClick);
    removeDocumentHandler('keydown', this._handleKeyDown);
    NovaDropdown.#instances.delete(this.dropdown);
  }
}


// ─── NovaToast ────────────────────────────────────────────────

/**
 * Компонент всплывающих уведомлений (toast notifications).
 *
 * Функции:
 * - 5 типов: primary, success, danger, warning, info
 * - 6 позиций на экране
 * - Автозакрытие с прогресс-баром
 * - ARIA: role="alert" для danger/warning, role="status" для остальных
 * - Реестр активных тостов (getAll, closeAll)
 * - XSS-защита сообщений
 *
 * @class NovaToast
 *
 * @example <caption>Через Nova API</caption>
 * nova.success('Данные сохранены!');
 * nova.error('Ошибка сервера', { duration: 0 });
 * nova.warning('Мало места', { position: 'bottom-end' });
 *
 * @example <caption>Напрямую</caption>
 * new NovaToast('Файл загружен', {
 *   type:     'success',
 *   duration: 5000,
 *   position: 'top-end',
 * });
 *
 * @example <caption>Управление реестром</caption>
 * const all = NovaToast.getAll();
 * NovaToast.closeAll();
 */
class NovaToast {

  /** @type {Map<string, HTMLElement>} @private */
  static #containers = new Map();

  /** @type {Set<NovaToast>} @private */
  static #instances = new Set();

  /**
   * Возвращает все активные тосты.
   * @returns {NovaToast[]}
   */
  static getAll() {
    return [...NovaToast.#instances];
  }

  /**
   * Закрывает все активные тосты.
   */
  static closeAll() {
    NovaToast.#instances.forEach(t => t.close());
  }

  /**
   * Создаёт и отображает тост.
   *
   * @param {string}  message                       - Текст уведомления
   * @param {object}  [options]
   * @param {string}  [options.title='Notification'] - Заголовок
   * @param {string}  [options.type='primary']       - Тип: primary|success|danger|warning|info
   * @param {number}  [options.duration=3000]        - Время показа мс. 0 = бесконечно.
   * @param {string}  [options.position='top-end']   - Позиция на экране
   * @param {boolean} [options.closeButton=true]     - Кнопка закрытия
   * @param {boolean} [options.progress=true]        - Прогресс-бар
   * @param {boolean} [options.html=false]           - Разрешить HTML. ⚠️ Только для доверенного контента!
   */
  constructor(message, options = {}) {
    this.options = {
      title:       options.title       ?? 'Notification',
      type:        options.type        ?? 'primary',
      duration:    options.duration    ?? 3000,
      position:    options.position    ?? 'top-end',
      closeButton: options.closeButton !== false,
      progress:    options.progress    !== false,
      html:        options.html        ?? false,
    };

    this.message = this.options.html ? message : NovaUtils.escapeHtml(message);
    this.title   = NovaUtils.escapeHtml(this.options.title);

    this._create();
    NovaToast.#instances.add(this);
  }

  /**
   * Возвращает или создаёт контейнер для позиции.
   * @private
   * @param {string} position
   * @returns {HTMLElement}
   */
  static _getContainer(position) {
    if (!NovaToast.#containers.has(position)) {
      const container = document.createElement('div');
      container.className = `nova toast-container toast-${position}`;
      container.setAttribute('aria-live',  'polite');
      container.setAttribute('aria-atomic', 'false');
      document.body.appendChild(container);
      NovaToast.#containers.set(position, container);
    }
    return NovaToast.#containers.get(position);
  }

  /**
   * Создаёт DOM-структуру тоста.
   * @private
   */
  _create() {
    this.container = NovaToast._getContainer(this.options.position);
    this.element   = document.createElement('div');
    this.element.className = `toast toast-${this.options.type}`;

    const isUrgent = ['danger', 'warning'].includes(this.options.type);
    this.element.setAttribute('role',        isUrgent ? 'alert'     : 'status');
    this.element.setAttribute('aria-live',   isUrgent ? 'assertive' : 'polite');
    this.element.setAttribute('aria-atomic', 'true');

    this.element.innerHTML = `
      <div class="toast-icon" aria-hidden="true"></div>
      <div class="toast-content">
        <h5 class="toast-title">${this.title}</h5>
        <p  class="toast-message">${this.message}</p>
      </div>
      ${this.options.closeButton
        ? `<button class="toast-close" aria-label="Close notification">
             <span aria-hidden="true">&times;</span>
           </button>`
        : ''
      }
      ${this.options.progress
        ? `<div class="toast-progress"
                role="progressbar"
                aria-hidden="true"
                style="animation-duration:${this.options.duration}ms">
           </div>`
        : ''
      }
    `;

    this.container.appendChild(this.element);

    if (this.options.closeButton) {
      this.element.querySelector('.toast-close')
        ?.addEventListener('click', () => this.close());
    }

    if (this.options.duration > 0) {
      this._timer = setTimeout(() => this.close(), this.options.duration);
    }
  }

  /**
   * Закрывает и удаляет тост с анимацией.
   * Учитывает prefers-reduced-motion.
   *
   * @example
   * const toast = nova.error('Ошибка', { duration: 0 });
   * toast.close();
   */
  close() {
    clearTimeout(this._timer);
    this.element.classList.add(CLASSES.DISMISSING);
    const duration = NovaUtils.animationDuration(ANIMATION_DURATION.TOAST);
    setTimeout(() => {
      this.element.remove();
      NovaToast.#instances.delete(this);
    }, duration);
  }

  /** Показывает тост (сбрасывает display:none). */
  show() { this.element.style.display = ''; }

  /** Скрывает тост без удаления из DOM. */
  hide() { this.element.style.display = 'none'; }
}


// ─── NovaTabs ─────────────────────────────────────────────────

/**
 * Компонент вкладок с поддержкой клавиатуры и ARIA.
 *
 * Реализует WAI-ARIA Tabs Pattern:
 * - role="tablist" / role="tab" / role="tabpanel"
 * - aria-selected, aria-controls, aria-labelledby
 * - Roving tabindex для навигации стрелками
 * - Циклическая навигация ArrowLeft/ArrowRight
 *
 * @class NovaTabs
 *
 * @example <caption>HTML</caption>
 * <div class="tabs">
 *   <div class="tabs-header">
 *     <button class="tab-link active" href="#tab-1">Вкладка 1</button>
 *     <button class="tab-link"        href="#tab-2">Вкладка 2</button>
 *   </div>
 *   <div class="tab-pane active" id="tab-1">Содержимое 1</div>
 *   <div class="tab-pane"        id="tab-2">Содержимое 2</div>
 * </div>
 *
 * @example <caption>JS</caption>
 * const tabs = new NovaTabs('.tabs');
 * tabs.show(1);
 *
 * tabsContainer.addEventListener('tab.show', (e) => {
 *   console.log('Активна вкладка:', e.detail.index);
 * });
 */
class NovaTabs {

  /** @type {WeakMap<HTMLElement, NovaTabs>} @private */
  static #instances = new WeakMap();

  /**
   * Создаёт экземпляр NovaTabs.
   *
   * @param {string|HTMLElement} tabsContainer - Корневой элемент .tabs
   * @param {object}  [options]
   * @param {boolean} [options.syncHash=false]
   *   Синхронизировать активный таб с URL hash.
   *   ⚠️ Отключи для SPA (React Router, Vue Router).
   */
  constructor(tabsContainer, options = {}) {
    this.container = typeof tabsContainer === 'string'
      ? document.querySelector(tabsContainer)
      : tabsContainer;

    if (!this.container || !this.container.isConnected) {
      console.warn('[NovaTabs] Element not found or not connected to DOM');
      return;
    }

    if (NovaTabs.#instances.has(this.container)) {
      return NovaTabs.#instances.get(this.container);
    }

    this.options = { syncHash: options.syncHash ?? false };

    this.tabs  = Array.from(this.container.querySelectorAll(SELECTORS.TAB_LINK));
    this.panes = Array.from(this.container.querySelectorAll(SELECTORS.TAB_PANE));

    this._init();
    NovaTabs.#instances.set(this.container, this);
  }

  /** @private */
  _init() {
    const tablist = this.container.querySelector(SELECTORS.TABS_HEADER);
    tablist?.setAttribute('role', 'tablist');

    const groupId = uid('nova-tabs');

    this.tabs.forEach((tab, index) => {
      tab.setAttribute('role',          'tab');
      tab.setAttribute('tabindex',      index === 0 ? '0' : '-1');
      tab.setAttribute('aria-selected', index === 0 ? 'true' : 'false');

      if (!tab.id) tab.id = `${groupId}-tab-${index}`;

      const pane = this.panes[index];
      if (pane) {
        if (!pane.id) pane.id = `${groupId}-panel-${index}`;
        tab.setAttribute('aria-controls',    pane.id);
        pane.setAttribute('role',            'tabpanel');
        pane.setAttribute('aria-labelledby', tab.id);
        pane.setAttribute('tabindex',        '0');
      }

      tab.addEventListener('click', (e) => {
        e.preventDefault();
        this.show(index);
      });

      tab.addEventListener('keydown', (e) => {
        let newIndex;
        const total = this.tabs.length;

        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            newIndex = (index + 1) % total;
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            newIndex = (index - 1 + total) % total;
            break;
          case 'Home':
            e.preventDefault();
            newIndex = 0;
            break;
          case 'End':
            e.preventDefault();
            newIndex = total - 1;
            break;
        }

        if (newIndex !== undefined) {
          this.show(newIndex);
          this.tabs[newIndex].focus();
        }
      });
    });

    if (this.options.syncHash && window.location.hash) {
      const hash = window.location.hash;
      const idx  = this.tabs.findIndex(
        t => t.getAttribute('href') === hash ||
             t.getAttribute('aria-controls') === hash.slice(1)
      );
      if (idx > -1) this.show(idx);
    }
  }

  /**
   * Активирует вкладку по индексу или идентификатору.
   *
   * @param {number|string} indexOrId
   *   Число — индекс (0-based).
   *   Строка — data-tab-id или href (например '#tab-1').
   * @fires {CustomEvent} tab.show - detail: { index, tab }
   *
   * @example
   * tabs.show(0);
   * tabs.show('#tab-1');
   * tabs.show('profile');
   */
  show(indexOrId) {
    let index;

    if (typeof indexOrId === 'string') {
      index = this.tabs.findIndex(
        tab => tab.getAttribute('data-tab-id') === indexOrId ||
               tab.getAttribute('href')        === indexOrId
      );
    } else {
      index = indexOrId;
    }

    if (index < 0 || index >= this.tabs.length) return;

    this.tabs.forEach((tab, i) => {
      const active = i === index;
      tab.classList.toggle(CLASSES.ACTIVE, active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.setAttribute('tabindex',      active ? '0'    : '-1');
    });

    this.panes.forEach((pane, i) => {
      pane.classList.toggle(CLASSES.ACTIVE, i === index);
    });

    if (this.options.syncHash) {
      const href = this.tabs[index]?.getAttribute('href');
      if (href?.startsWith('#')) history.replaceState(null, '', href);
    }

    this.container.dispatchEvent(new CustomEvent('tab.show', {
      detail: { index, tab: this.tabs[index] },
    }));
  }

  /**
   * Возвращает индекс активной вкладки.
   * @returns {number} Индекс или 0 если ни одна не активна
   */
  getActive() {
    const index = this.tabs.findIndex(tab => tab.classList.contains(CLASSES.ACTIVE));
    return index >= 0 ? index : 0;
  }

  /** Удаляет экземпляр из реестра. */
  destroy() { NovaTabs.#instances.delete(this.container); }
}


// ─── NovaCollapse ─────────────────────────────────────────────

/**
 * Компонент сворачиваемого блока с анимацией max-height.
 *
 * Функции:
 * - Плавная анимация через max-height
 * - prefers-reduced-motion — мгновенное переключение
 * - Корректный hidden-атрибут после анимации закрытия
 * - Клавиатура: Enter, Space
 * - ARIA: role="button", aria-expanded, aria-controls, role="region"
 *
 * @class NovaCollapse
 *
 * @example <caption>HTML</caption>
 * <div class="collapse-item">
 *   <div class="collapse-header">Заголовок</div>
 *   <div class="collapse-body">Содержимое</div>
 * </div>
 *
 * @example <caption>JS</caption>
 * const collapse = new NovaCollapse('.collapse-item');
 * collapse.open();
 *
 * @example <caption>CSS</caption>
 * .collapse-body { overflow: hidden; max-height: 0; }
 */
class NovaCollapse {

  /** @type {WeakMap<HTMLElement, NovaCollapse>} @private */
  static #instances = new WeakMap();

  /**
   * @param {string|HTMLElement} collapseElement - Корневой элемент .collapse-item
   */
  constructor(collapseElement) {
    this.element = typeof collapseElement === 'string'
      ? document.querySelector(collapseElement)
      : collapseElement;

    if (!this.element || !this.element.isConnected) {
      console.warn('[NovaCollapse] Element not found or not connected to DOM');
      return;
    }

    if (NovaCollapse.#instances.has(this.element)) {
      return NovaCollapse.#instances.get(this.element);
    }

    this.header       = this.element.querySelector(SELECTORS.COLLAPSE_HEADER);
    this.body         = this.element.querySelector(SELECTORS.COLLAPSE_BODY);
    this._handleClick = this._onClick.bind(this);

    this._init();
    NovaCollapse.#instances.set(this.element, this);
  }

  /** @private */
  _init() {
    if (!this.header) return;

    this.header.setAttribute('role',          'button');
    this.header.setAttribute('aria-expanded', 'false');
    this.header.setAttribute('tabindex',      '0');

    if (this.body) {
      if (!this.body.id) this.body.id = uid('nova-collapse');
      this.header.setAttribute('aria-controls', this.body.id);
      this.body.setAttribute('role',   'region');
      this.body.setAttribute('hidden', '');
    }

    this.header.addEventListener('click', this._handleClick);
    this.header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  /** @private */
  _onClick() { this.toggle(); }

  /**
   * Открывает блок с анимацией max-height.
   * При prefers-reduced-motion — мгновенно.
   * @fires {Event} collapse.open
   */
  open() {
    if (this.isOpen()) return;

    this.element.classList.add(CLASSES.ACTIVE);
    this.header?.classList.add(CLASSES.ACTIVE);
    this.header?.setAttribute('aria-expanded', 'true');

    if (this.body) {
      this.body.removeAttribute('hidden');
      this.body.style.maxHeight = 'none';
      const height = this.body.scrollHeight;
      this.body.style.maxHeight = '0';
      void this.body.offsetHeight;

      const duration = NovaUtils.animationDuration(ANIMATION_DURATION.COLLAPSE);
      this.body.style.transition = duration > 0
        ? `max-height ${duration}ms var(--nova-easing-standard, ease),
           padding    ${duration}ms var(--nova-easing-standard, ease)`
        : 'none';

      this.body.style.maxHeight = `${height}px`;
      this.body.style.padding   = '';
    }

    this.element.dispatchEvent(new Event('collapse.open'));
  }

  /**
   * Закрывает блок с анимацией max-height.
   * При prefers-reduced-motion — ставит hidden немедленно без ожидания transitionend.
   * @fires {Event} collapse.close
   */
  close() {
    if (!this.isOpen()) return;

    this.element.classList.remove(CLASSES.ACTIVE);
    this.header?.classList.remove(CLASSES.ACTIVE);
    this.header?.setAttribute('aria-expanded', 'false');

    if (this.body) {
      this.body.style.maxHeight = `${this.body.scrollHeight}px`;
      void this.body.offsetHeight;

      const duration = NovaUtils.animationDuration(ANIMATION_DURATION.COLLAPSE);
      this.body.style.transition = duration > 0
        ? `max-height ${duration}ms var(--nova-easing-standard, ease),
           padding    ${duration}ms var(--nova-easing-standard, ease)`
        : 'none';

      this.body.style.maxHeight = '0';
      this.body.style.padding   = '0';

      if (duration === 0) {
        this.body.setAttribute('hidden', '');
      } else {
        this.body.addEventListener('transitionend', () => {
          this.body.setAttribute('hidden', '');
        }, { once: true });
      }
    }

    this.element.dispatchEvent(new Event('collapse.close'));
  }

  /** Переключает состояние блока. */
  toggle() { this.isOpen() ? this.close() : this.open(); }

  /** @returns {boolean} */
  isOpen() { return this.element?.classList.contains(CLASSES.ACTIVE) ?? false; }

  /** Удаляет обработчики и экземпляр из реестра. */
  destroy() {
    this.header?.removeEventListener('click', this._handleClick);
    NovaCollapse.#instances.delete(this.element);
  }
}


// ─── NovaCarousel ─────────────────────────────────────────────

/**
 * Компонент карусели слайдов.
 *
 * Функции:
 * - Авто-прокрутка с паузой при hover/focus
 * - Touch/swipe (только горизонтальные свайпы)
 * - Клавиатура: ArrowLeft/ArrowRight
 * - Индикаторы слайдов
 * - Зацикливание (wrap)
 * - Защита от двойной анимации (isAnimating)
 * - prefers-reduced-motion
 * - aria-hidden инициализируется для всех слайдов сразу
 *
 * @class NovaCarousel
 *
 * @example <caption>HTML</caption>
 * <div data-carousel>
 *   <div class="carousel-inner">
 *     <div class="carousel-item">Слайд 1</div>
 *     <div class="carousel-item">Слайд 2</div>
 *   </div>
 *   <button data-slide="prev" aria-label="Назад">&#8249;</button>
 *   <button data-slide="next" aria-label="Вперёд">&#8250;</button>
 *   <div class="carousel-indicators">
 *     <button data-slide-to="0"></button>
 *     <button data-slide-to="1"></button>
 *   </div>
 * </div>
 *
 * @example <caption>JS</caption>
 * const carousel = new NovaCarousel('[data-carousel]', { interval: 4000 });
 * carousel.goTo(1);
 *
 * carousel.carousel.addEventListener('carousel.change', (e) => {
 *   console.log('Слайд:', e.detail.index);
 * });
 */
class NovaCarousel {

  /** @type {WeakMap<HTMLElement, NovaCarousel>} @private */
  static #instances = new WeakMap();

  /**
   * @param {string|HTMLElement} carouselElement - Корневой элемент [data-carousel]
   * @param {object}         [options]
   * @param {number}         [options.interval=5000] - Интервал авто-прокрутки мс. 0 = выкл.
   * @param {boolean}        [options.keyboard=true]  - Клавиатурная навигация
   * @param {'hover'|false}  [options.pause='hover']  - Пауза при hover/focus
   * @param {boolean}        [options.wrap=true]       - Зацикливать слайды
   * @param {boolean}        [options.touch=true]      - Touch/swipe навигация
   */
  constructor(carouselElement, options = {}) {
    this.carousel = typeof carouselElement === 'string'
      ? document.querySelector(carouselElement)
      : carouselElement;

    if (!this.carousel || !this.carousel.isConnected) {
      console.warn('[NovaCarousel] Element not found or not connected to DOM');
      return;
    }

    if (NovaCarousel.#instances.has(this.carousel)) {
      return NovaCarousel.#instances.get(this.carousel);
    }

    this.options = {
      interval: 5000,
      keyboard: true,
      pause:    'hover',
      wrap:     true,
      touch:    true,
      ...options,
    };

    this.currentIndex = 0;
    this.slides       = Array.from(this.carousel.querySelectorAll(SELECTORS.CAROUSEL_ITEM));
    this.indicators   = Array.from(this.carousel.querySelectorAll('[data-slide-to]'));
    this.isAnimating  = false;
    this._timer       = null;

    this._handleKey   = this._onKeyDown.bind(this);
    this._handleEnter = () => this.pause();
    this._handleLeave = () => this.play();

    this._init();
    NovaCarousel.#instances.set(this.carousel, this);
  }

  /** @private */
  _init() {
    if (!this.slides.length) return;

    this.carousel.setAttribute('role', 'region');
    this.carousel.setAttribute('aria-roledescription', 'carousel');

    this.slides.forEach((slide, i) => {
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${i + 1} из ${this.slides.length}`);
      slide.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
    });

    this.slides[0]?.classList.add(CLASSES.ACTIVE);
    this.indicators[0]?.classList.add(CLASSES.ACTIVE);

    const prevBtn = this.carousel.querySelector('[data-slide="prev"]');
    const nextBtn = this.carousel.querySelector('[data-slide="next"]');
    prevBtn?.addEventListener('click', () => this.prev());
    nextBtn?.addEventListener('click', () => this.next());

    this.indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => this.goTo(index));
    });

    if (this.options.keyboard) {
      this.carousel.setAttribute('tabindex', '0');
      this.carousel.addEventListener('keydown', this._handleKey);
    }

    if (this.options.pause === 'hover') {
      this.carousel.addEventListener('mouseenter', this._handleEnter);
      this.carousel.addEventListener('mouseleave', this._handleLeave);
      this.carousel.addEventListener('focusin',    this._handleEnter);
      this.carousel.addEventListener('focusout',   this._handleLeave);
    }

    if (this.options.touch) this._initTouch();
    if (this.options.interval > 0) this.play();
  }

  /**
   * Инициализирует touch/swipe навигацию.
   * Реагирует только на горизонтальные свайпы (|dx| > |dy| и |dx| > 50px).
   * @private
   */
  _initTouch() {
    let startX = 0;
    let startY = 0;

    this.carousel.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    this.carousel.addEventListener('touchend', (e) => {
      const dx = startX - e.changedTouches[0].clientX;
      const dy = startY - e.changedTouches[0].clientY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
        dx > 0 ? this.next() : this.prev();
      }
    }, { passive: true });
  }

  /** @private @param {KeyboardEvent} e */
  _onKeyDown(e) {
    switch (e.key) {
      case 'ArrowLeft':  e.preventDefault(); this.prev(); break;
      case 'ArrowRight': e.preventDefault(); this.next(); break;
    }
  }

  /**
   * Переходит к слайду по индексу. Защита от двойной анимации.
   *
   * @param {number} index - Индекс слайда (0-based)
   * @fires {CustomEvent} carousel.change - detail: { index }
   *
   * @example
   * carousel.goTo(2);
   */
  goTo(index) {
    if (this.isAnimating || index === this.currentIndex) return;
    if (index < 0 || index >= this.slides.length) return;

    this.isAnimating = true;

    this.slides[this.currentIndex]?.classList.remove(CLASSES.ACTIVE);
    this.indicators[this.currentIndex]?.classList.remove(CLASSES.ACTIVE);

    this.slides[index]?.classList.add(CLASSES.ACTIVE);
    this.indicators[index]?.classList.add(CLASSES.ACTIVE);

    this.slides.forEach((slide, i) => {
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });

    this.currentIndex = index;

    const delay = NovaUtils.animationDuration(ANIMATION_DURATION.CAROUSEL);
    setTimeout(() => {
      this.isAnimating = false;
      this.carousel.dispatchEvent(
        new CustomEvent('carousel.change', { detail: { index } })
      );
    }, delay);
  }

  /**
   * Переходит к следующему слайду.
   * При wrap: true — зацикливается на первый после последнего.
   */
  next() {
    const nextIndex = this.options.wrap
      ? (this.currentIndex + 1) % this.slides.length
      : Math.min(this.currentIndex + 1, this.slides.length - 1);
    this.goTo(nextIndex);
  }

  /**
   * Переходит к предыдущему слайду.
   * При wrap: true — зацикливается на последний перед первым.
   */
  prev() {
    const prevIndex = this.options.wrap
      ? (this.currentIndex - 1 + this.slides.length) % this.slides.length
      : Math.max(this.currentIndex - 1, 0);
    this.goTo(prevIndex);
  }

  /** Запускает авто-прокрутку. Ничего не делает если уже запущена. */
  play() {
    if (this._timer) return;
    this._timer = setInterval(() => this.next(), this.options.interval);
  }

  /** Останавливает авто-прокрутку. */
  pause() {
    clearInterval(this._timer);
    this._timer = null;
  }

  /**
   * @returns {number} Индекс текущего слайда
   */
  getCurrentIndex() { return this.currentIndex; }

  /** Останавливает прокрутку, удаляет обработчики и экземпляр из реестра. */
  destroy() {
    this.pause();
    if (this.options.keyboard) {
      this.carousel.removeEventListener('keydown', this._handleKey);
    }
    if (this.options.pause === 'hover') {
      this.carousel.removeEventListener('mouseenter', this._handleEnter);
      this.carousel.removeEventListener('mouseleave', this._handleLeave);
      this.carousel.removeEventListener('focusin',    this._handleEnter);
      this.carousel.removeEventListener('focusout',   this._handleLeave);
    }
    NovaCarousel.#instances.delete(this.carousel);
  }
}


// ─── NovaTooltip ──────────────────────────────────────────────

/**
 * Компонент подсказок (tooltip).
 *
 * Функции:
 * - 4 позиции: top, bottom, left, right
 * - 3 триггера: hover, click, focus
 * - Задержка показа/скрытия
 * - position: fixed — не улетает при скролле
 * - Коррекция выхода за границы viewport
 * - Throttled репозиция при resize/scroll
 * - Самоочистка при удалении элемента из DOM
 * - ARIA: role="tooltip", aria-describedby
 *
 * @class NovaTooltip
 *
 * @example <caption>HTML — авто-инициализация</caption>
 * <button data-tooltip="Нажмите для сохранения">Сохранить</button>
 *
 * @example <caption>JS</caption>
 * const tooltip = new NovaTooltip('#btn', {
 *   title:     'Удалить навсегда',
 *   placement: 'bottom',
 *   delay:     { show: 200, hide: 100 },
 * });
 *
 * @example <caption>Обновить текст</caption>
 * tooltip.setTitle('Новая подсказка');
 */
class NovaTooltip {

  /** @type {WeakMap<HTMLElement, NovaTooltip>} @private */
  static #instances = new WeakMap();

  /**
   * Возвращает существующий экземпляр NovaTooltip.
   *
   * @param {string|HTMLElement} el
   * @returns {NovaTooltip|undefined}
   */
  static getInstance(el) {
    const element = typeof el === 'string' ? document.querySelector(el) : el;
    return NovaTooltip.#instances.get(element);
  }

  /**
   * @param {string|HTMLElement} element - Целевой элемент
   * @param {object}             [options]
   * @param {string}             [options.title]           - Текст. Если нет — из data-tooltip.
   * @param {'top'|'bottom'|'left'|'right'} [options.placement='top'] - Позиция
   * @param {'hover'|'click'|'focus'}       [options.trigger='hover'] - Триггер
   * @param {number|{show:number,hide:number}} [options.delay] - Задержка мс
   * @param {boolean} [options.html=false] - HTML в title. ⚠️ Только доверенный контент!
   */
  constructor(element, options = {}) {
    this.element = typeof element === 'string'
      ? document.querySelector(element)
      : element;

    if (!this.element || !this.element.isConnected) {
      console.warn('[NovaTooltip] Element not found or not connected to DOM');
      return;
    }

    if (NovaTooltip.#instances.has(this.element)) {
      return NovaTooltip.#instances.get(this.element);
    }

    this.options = {
      title:     options.title     ?? this.element.getAttribute('data-tooltip') ?? '',
      placement: options.placement ?? 'top',
      trigger:   options.trigger   ?? 'hover',
      delay:     typeof options.delay === 'number'
                   ? { show: options.delay, hide: options.delay }
                   : { ...{ show: 0, hide: 100 }, ...(options.delay ?? {}) },
      html:      options.html ?? false,
    };

    this.tooltip    = null;
    this._showTimer = null;
    this._hideTimer = null;
    this.isVisible  = false;

    this._handleShow  = () => this.show();
    this._handleHide  = () => this.hide();
    this._handleClick = (e) => { e.stopPropagation(); this.toggle(); };

    /**
     * Обрабатывает клики по document для trigger='click'.
     * При удалении элемента из DOM — вызывает destroy() для самоочистки.
     * @private
     */
    this._handleDocClick = (e) => {
      if (!this.element.isConnected) {
        this.destroy();
        return;
      }
      if (!this.element.contains(e.target)) this.hide();
    };

    /**
     * Throttled пересчёт позиции при scroll/resize.
     * Ссылка сохранена для removeEventListener в destroy().
     * @private
     */
    this._handleReposition = NovaUtils.throttle(() => {
      if (this.isVisible) this._positionTooltip();
    }, 50);

    this._init();
    NovaTooltip.#instances.set(this.element, this);
  }

  /** @private */
  _init() {
    if (this.element.hasAttribute('title') && !this.options.title) {
      this.options.title = this.element.getAttribute('title');
    }
    this.element.removeAttribute('title');
    this.element.setAttribute('aria-describedby', '');

    switch (this.options.trigger) {
      case 'hover':
        this.element.addEventListener('mouseenter', this._handleShow);
        this.element.addEventListener('mouseleave', this._handleHide);
        this.element.addEventListener('focus',      this._handleShow);
        this.element.addEventListener('blur',       this._handleHide);
        break;
      case 'click':
        this.element.addEventListener('click', this._handleClick);
        addDocumentHandler('click', this._handleDocClick);
        break;
      case 'focus':
        this.element.addEventListener('focus', this._handleShow);
        this.element.addEventListener('blur',  this._handleHide);
        break;
    }

    window.addEventListener('scroll', this._handleReposition, { passive: true });
    window.addEventListener('resize', this._handleReposition, { passive: true });
  }

  /**
   * Создаёт DOM-элемент тултипа с position:fixed.
   * position:fixed — корректное позиционирование при любом скролле.
   * @private
   * @returns {HTMLElement}
   */
  _createTooltip() {
    const tooltip = document.createElement('div');
    tooltip.className = `nova tooltip tooltip-${this.options.placement}`;
    tooltip.setAttribute('role',        'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.id = uid('nova-tooltip');
    tooltip.style.position = 'fixed';

    const content = document.createElement('p');
    content.className = 'tooltip-content';

    this.options.html
      ? (content.innerHTML   = this.options.title)
      : (content.textContent = this.options.title);

    tooltip.appendChild(content);
    document.body.appendChild(tooltip);
    return tooltip;
  }

  /**
   * Вычисляет позицию тултипа и корректирует выход за границы viewport (отступ 8px).
   * Не использует scrollY/scrollX — работает с position:fixed.
   * @private
   */
  _positionTooltip() {
    if (!this.tooltip) return;

    const rect   = this.element.getBoundingClientRect();
    const tip    = this.tooltip.getBoundingClientRect();
    const offset = 10;
    const vw     = window.innerWidth;
    const vh     = window.innerHeight;

    let top, left;

    switch (this.options.placement) {
      case 'top':
        top  = rect.top  - tip.height - offset;
        left = rect.left + rect.width  / 2 - tip.width / 2;
        break;
      case 'bottom':
        top  = rect.bottom + offset;
        left = rect.left + rect.width  / 2 - tip.width / 2;
        break;
      case 'left':
        top  = rect.top  + rect.height / 2 - tip.height / 2;
        left = rect.left - tip.width - offset;
        break;
      case 'right':
        top  = rect.top  + rect.height / 2 - tip.height / 2;
        left = rect.right + offset;
        break;
    }

    left = Math.max(8, Math.min(left, vw - tip.width  - 8));
    top  = Math.max(8, Math.min(top,  vh - tip.height - 8));

    this.tooltip.style.top  = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  /**
   * Показывает тултип с учётом задержки delay.show.
   * @fires {Event} tooltip.show
   */
  show() {
    if (this.isVisible || !this.options.title) return;
    clearTimeout(this._hideTimer);

    this._showTimer = setTimeout(() => {
      if (!this.tooltip) this.tooltip = this._createTooltip();

      this._positionTooltip();
      this.tooltip.classList.add(CLASSES.SHOW);
      this.tooltip.setAttribute('aria-hidden', 'false');
      this.element.setAttribute('aria-describedby', this.tooltip.id);
      this.isVisible = true;
      this.element.dispatchEvent(new Event('tooltip.show'));
    }, this.options.delay.show);
  }

  /**
   * Скрывает тултип с учётом задержки delay.hide.
   * @fires {Event} tooltip.hide
   */
  hide() {
    if (!this.isVisible) return;
    clearTimeout(this._showTimer);

    this._hideTimer = setTimeout(() => {
      this.tooltip?.classList.remove(CLASSES.SHOW);
      this.tooltip?.setAttribute('aria-hidden', 'true');
      this.element.removeAttribute('aria-describedby');
      this.isVisible = false;
      this.element.dispatchEvent(new Event('tooltip.hide'));
    }, this.options.delay.hide);
  }

  /** Переключает видимость тултипа. */
  toggle() { this.isVisible ? this.hide() : this.show(); }

  /**
   * Обновляет текст/HTML тултипа без пересоздания DOM-элемента.
   *
   * @param {string} title - Новый текст или HTML (при options.html: true)
   *
   * @example
   * tooltip.setTitle('Новая подсказка');
   */
  setTitle(title) {
    this.options.title = title;
    if (this.tooltip) {
      const content = this.tooltip.querySelector('.tooltip-content');
      if (content) {
        this.options.html
          ? (content.innerHTML   = title)
          : (content.textContent = title);
      }
    }
  }

  /**
   * Скрывает тултип, удаляет обработчики и DOM-элемент.
   */
  destroy() {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);

    this.element.removeEventListener('mouseenter', this._handleShow);
    this.element.removeEventListener('mouseleave', this._handleHide);
    this.element.removeEventListener('focus',      this._handleShow);
    this.element.removeEventListener('blur',       this._handleHide);
    this.element.removeEventListener('click',      this._handleClick);

    removeDocumentHandler('click', this._handleDocClick);

    window.removeEventListener('scroll', this._handleReposition);
    window.removeEventListener('resize', this._handleReposition);

    this.tooltip?.remove();
    this.tooltip = null;
    NovaTooltip.#instances.delete(this.element);
  }
}


// ─── Nova ─────────────────────────────────────────────────────

/**
 * Ядро Nova Framework. Singleton.
 *
 * Отвечает за:
 * - Авто-инициализацию компонентов при загрузке
 * - MutationObserver для динамического контента
 * - Управление темой (light/dark) с localStorage
 * - Централизованную систему событий nova:*
 * - API для модалов и тостов
 * - Поддержку плагинов
 *
 * @class Nova
 *
 * @example <caption>Старт</caption>
 * import nova from './nova.js';
 * await nova.ready();
 *
 * @example <caption>Тема</caption>
 * nova.setTheme('dark');
 * nova.toggleTheme();
 *
 * @example <caption>События</caption>
 * nova.on('nova:ready', (e) => console.log(e.detail.version));
 * nova.on('nova:theme-change', (e) => applyTheme(e.detail.theme));
 *
 * @example <caption>Плагин</caption>
 * nova.use({
 *   install(nova) {
 *     nova.myMethod = () => console.log('Плагин работает!');
 *   }
 * });
 */
class Nova {

  /** @type {Nova|null} @private */
  static #instance = null;

  /**
   * Реестр инициализированных компонентов.
   * WeakMap обеспечивает автоматическую очистку при удалении элементов.
   * @type {WeakMap<HTMLElement, object>}
   */
  static registry = new WeakMap();

  /** @type {Map<string, Function>} @private */
  static #componentMap = new Map([
    [SELECTORS.MODAL,    NovaModal],
    [SELECTORS.DROPDOWN, NovaDropdown],
    [SELECTORS.TABS,     NovaTabs],
    [SELECTORS.COLLAPSE, NovaCollapse],
    [SELECTORS.CAROUSEL, NovaCarousel],
    [SELECTORS.TOOLTIP,  NovaTooltip],
  ]);

  /**
   * Диспатчит событие фреймворка на document с префиксом 'nova:'.
   * Статический — доступен компонентам без ссылки на экземпляр.
   *
   * @param {string} eventName - Имя без префикса (например 'modal-open')
   * @param {object} [detail]
   *
   * @example
   * Nova.dispatchFrameworkEvent('modal-open', { modal: el });
   */
  static dispatchFrameworkEvent(eventName, detail = {}) {
    document.dispatchEvent(
      new CustomEvent(`nova:${eventName}`, { detail, bubbles: true })
    );
  }

  /**
   * Возвращает singleton-экземпляр Nova.
   *
   * @param {object} [options]
   * @returns {Nova}
   *
   * @example
   * const nova = Nova.getInstance();
   */
  static getInstance(options = {}) {
    if (!Nova.#instance) Nova.#instance = new Nova(options);
    return Nova.#instance;
  }

  /**
   * Получает компонент по DOM-элементу из реестра.
   *
   * @param {string|HTMLElement} el
   * @returns {object|undefined}
   *
   * @example
   * const modal = Nova.getComponent('#my-modal');
   * if (modal instanceof NovaModal) modal.open();
   */
  static getComponent(el) {
    const element = typeof el === 'string' ? document.querySelector(el) : el;
    return element ? Nova.registry.get(element) : undefined;
  }

  /**
   * @private Используй Nova.getInstance()
   * @param {object} [options]
   */
  constructor(options = {}) {
    if (Nova.#instance) return Nova.#instance;

    /** @type {string} */
    this.version    = '2.0.0';

    /** @type {Map<string, object>} */
    this.components = new Map();

    /** @type {object[]} */
    this.plugins    = [];

    this._observer  = null;
    this._options   = options;

    this._bootPromise = this._boot();
    Nova.#instance = this;
  }

  /**
   * Асинхронная инициализация:
   * 1. Определение темы
   * 2. Глобальные обработчики
   * 3. Ожидание DOMContentLoaded
   * 4. Инициализация компонентов
   * 5. MutationObserver
   * 6. Событие nova:ready
   * @private
   */
  async _boot() {
    await this._detectTheme();
    this._initEventListeners();

    if (document.readyState === 'loading') {
      await new Promise(resolve =>
        document.addEventListener('DOMContentLoaded', resolve, { once: true })
      );
    }

    this._initAll(document);
    this._initMutationObserver();
    this.trigger('ready', { version: this.version });
  }

  /**
   * Ожидает завершения инициализации фреймворка.
   *
   * @returns {Promise<void>}
   *
   * @example
   * await nova.ready();
   * const modal = NovaModal.getInstance('#my-modal');
   */
  ready() { return this._bootPromise; }

  /**
   * Определяет тему: localStorage → prefers-color-scheme → 'light'.
   * Подписывается на изменения системной темы.
   * @private
   */
  async _detectTheme() {
    if (typeof window === 'undefined') return;

    const saved     = localStorage.getItem('nova-theme');
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';

    document.documentElement.setAttribute('data-nova-theme', saved ?? preferred);

    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!localStorage.getItem('nova-theme')) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
  }

  /**
   * Инициализирует все компоненты в контексте root.
   * Пропускает уже зарегистрированные элементы.
   * @param {Document|HTMLElement} [root=document]
   * @private
   */
  _initAll(root = document) {
    Nova.#componentMap.forEach((Component, selector) => {
      root.querySelectorAll(selector).forEach(el => {
        if (Nova.registry.has(el)) return;
        try {
          const instance = new Component(el);
          Nova.registry.set(el, instance);
        } catch (err) {
          console.error(`[Nova] Failed to init ${Component.name} on`, el, err);
        }
      });
    });

    root.querySelectorAll(SELECTORS.MODAL_TOGGLE).forEach(btn => {
      if (Nova.registry.has(btn)) return;
      const handler = () => {
        const modalId = btn.getAttribute('data-modal-toggle');
        const modal   = document.querySelector(modalId);
        if (modal) {
          (NovaModal.getInstance(modal) ?? new NovaModal(modal)).toggle();
        }
      };
      btn.addEventListener('click', handler);
      Nova.registry.set(btn, {
        destroy: () => btn.removeEventListener('click', handler),
      });
    });
  }

  /**
   * MutationObserver для авто-инициализации динамического контента.
   *
   * Особенности:
   * - Set накапливает узлы (debounce не теряет элементы)
   * - isConnected проверяет наличие в DOM перед инициализацией
   * - removedNodes убирает из очереди узлы добавленные и сразу удалённые
   * @private
   */
  _initMutationObserver() {
    const pending = new Set();

    const flush = NovaUtils.debounce(() => {
      pending.forEach(node => {
        if (node.isConnected) this._initAll(node);
      });
      pending.clear();
    }, 100);

    this._observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          pending.add(node);
        });
        mutation.removedNodes.forEach(node => {
          pending.delete(node);
        });
      });
      flush();
    });

    this._observer.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Вручную инициализирует компоненты во фрагменте DOM.
   * Используй для динамического контента, SPA, React/Vue порталов.
   *
   * @param {string|HTMLElement} root
   *
   * @example
   * container.innerHTML = await fetchContent();
   * nova.initFragment(container);
   */
  initFragment(root) {
    const element = typeof root === 'string' ? document.querySelector(root) : root;
    if (element) this._initAll(element);
  }

  /**
   * Уничтожает все компоненты во фрагменте DOM.
   * Вызывай перед удалением фрагмента.
   *
   * @param {string|HTMLElement} root
   *
   * @example
   * nova.destroyFragment('#dynamic-content');
   * document.querySelector('#dynamic-content').remove();
   */
  destroyFragment(root) {
    const element = typeof root === 'string' ? document.querySelector(root) : root;
    if (!element) return;
    element.querySelectorAll('*').forEach(el => {
      const instance = Nova.registry.get(el);
      instance?.destroy?.();
      Nova.registry.delete(el);
    });
  }

  /**
   * Глобальный Escape — fallback если модал не навесил собственный listener.
   * @private
   */
  _initEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const modal = document.querySelector(`.modal.${CLASSES.SHOW}`);
      if (modal) NovaModal.getInstance(modal)?.close();
    });
  }

  // ── Тема ──────────────────────────────────────────────────

  /**
   * Устанавливает тему. Сохраняет в localStorage и применяет к html[data-nova-theme].
   *
   * @param {'light'|'dark'} theme
   * @returns {boolean} true если применена, false при неверном значении
   * @fires {CustomEvent} nova:theme-change - detail: { theme }
   *
   * @example
   * nova.setTheme('dark');
   */
  setTheme(theme) {
    if (!['light', 'dark'].includes(theme)) {
      console.warn(`[Nova] Unknown theme: "${theme}"`);
      return false;
    }
    document.documentElement.setAttribute('data-nova-theme', theme);
    localStorage.setItem('nova-theme', theme);
    this.trigger('theme-change', { theme });
    return true;
  }

  /**
   * @returns {'light'|'dark'} Текущая тема
   */
  getTheme() {
    return document.documentElement.getAttribute('data-nova-theme') ?? 'light';
  }

  /**
   * Переключает между light и dark.
   * @returns {boolean}
   *
   * @example
   * themeBtn.addEventListener('click', () => nova.toggleTheme());
   */
  toggleTheme() {
    return this.setTheme(this.getTheme() === 'dark' ? 'light' : 'dark');
  }

  // ── Модалы ────────────────────────────────────────────────

  /**
   * Открывает модальное окно. Создаёт экземпляр если не существует.
   * @param {string|HTMLElement} el
   *
   * @example
   * nova.openModal('#confirm-dialog');
   */
  openModal(el) {
    const element = typeof el === 'string' ? document.querySelector(el) : el;
    if (!element) return;
    (NovaModal.getInstance(element) ?? new NovaModal(element)).open();
  }

  /**
   * Закрывает модальное окно.
   * @param {string|HTMLElement} el
   *
   * @example
   * nova.closeModal('#confirm-dialog');
   */
  closeModal(el) {
    const element = typeof el === 'string' ? document.querySelector(el) : el;
    NovaModal.getInstance(element)?.close();
  }

  // ── Тосты ─────────────────────────────────────────────────

  /**
   * Создаёт тост с типом primary.
   * @param {string} message
   * @param {object} [options]
   * @returns {NovaToast}
   */
  toast(message, options = {}) {
    return new NovaToast(message, options);
  }

  /**
   * Создаёт тост success (зелёный).
   * @param {string} message
   * @param {object} [options]
   * @returns {NovaToast}
   * @example nova.success('Сохранено!');
   */
  success(message, options = {}) {
    return new NovaToast(message, { ...options, type: 'success', title: options.title ?? 'Success' });
  }

  /**
   * Создаёт тост danger (красный).
   * @param {string} message
   * @param {object} [options]
   * @returns {NovaToast}
   * @example nova.error('Ошибка сервера', { duration: 0 });
   */
  error(message, options = {}) {
    return new NovaToast(message, { ...options, type: 'danger', title: options.title ?? 'Error' });
  }

  /**
   * Создаёт тост warning (жёлтый).
   * @param {string} message
   * @param {object} [options]
   * @returns {NovaToast}
   * @example nova.warning('Сессия скоро истечёт.');
   */
  warning(message, options = {}) {
    return new NovaToast(message, { ...options, type: 'warning', title: options.title ?? 'Warning' });
  }

  /**
   * Создаёт тост info (синий).
   * @param {string} message
   * @param {object} [options]
   * @returns {NovaToast}
   * @example nova.info('Доступна новая версия.');
   */
  info(message, options = {}) {
    return new NovaToast(message, { ...options, type: 'info', title: options.title ?? 'Info' });
  }

  // ── События ───────────────────────────────────────────────

  /**
   * Диспатчит событие фреймворка (делегирует Nova.dispatchFrameworkEvent).
   *
   * @param {string} eventName - Без префикса 'nova:'
   * @param {object} [detail]
   *
   * @example
   * nova.trigger('my-event', { data: 42 });
   */
  trigger(eventName, detail = {}) {
    Nova.dispatchFrameworkEvent(eventName, detail);
  }

  /**
   * Подписывается на событие фреймворка.
   *
   * @param {string}   eventName - Без префикса ('ready', 'theme-change' и т.д.)
   * @param {Function} callback
   * @returns {this}
   *
   * @example
   * nova
   *   .on('nova:ready', () => console.log('Готово'))
   *   .on('nova:theme-change', (e) => applyTheme(e.detail.theme));
   */
  on(eventName, callback) {
    document.addEventListener(`nova:${eventName}`, callback);
    return this;
  }

  /**
   * Отписывается от события фреймворка.
   *
   * @param {string}   eventName
   * @param {Function} callback - Та же ссылка что в on()
   * @returns {this}
   *
   * @example
   * nova.off('nova:ready', handler);
   */
  off(eventName, callback) {
    document.removeEventListener(`nova:${eventName}`, callback);
    return this;
  }

  // ── Плагины ───────────────────────────────────────────────

  /**
   * Устанавливает плагин. Повторный вызов игнорируется.
   *
   * @param {{ install: (nova: Nova) => void }} plugin
   * @returns {this}
   *
   * @example
   * nova.use({
   *   install(nova) {
   *     nova.myMethod = () => console.log('ok');
   *   }
   * });
   */
  use(plugin) {
    if (this.plugins.includes(plugin)) return this;
    if (typeof plugin.install === 'function') {
      plugin.install(this);
      this.plugins.push(plugin);
    }
    return this;
  }

  // ── Реестр компонентов ────────────────────────────────────

  /**
   * Регистрирует кастомный компонент.
   * При наличии selector — добавляется в авто-инициализацию.
   *
   * @param {string} name
   * @param {object} component
   * @returns {this}
   *
   * @example
   * class MySlider { static selector = '[data-slider]'; }
   * nova.register('slider', MySlider);
   */
  register(name, component) {
    this.components.set(name, component);
    if (component.selector) {
      Nova.#componentMap.set(component.selector, component);
    }
    return this;
  }

  /**
   * Возвращает зарегистрированный компонент по имени.
   * @param {string} name
   * @returns {object|undefined}
   */
  get(name) { return this.components.get(name); }

  /**
   * @returns {string} Версия фреймворка
   * @example nova.getVersion(); // '2.0.0'
   */
  getVersion() { return this.version; }

  /**
   * Уничтожает экземпляр Nova.
   * Останавливает MutationObserver и сбрасывает singleton.
   *
   * @example
   * // В тестах:
   * afterEach(() => nova.destroy());
   */
  destroy() {
    this._observer?.disconnect();
    Nova.#instance = null;
  }
}


// ─── Singleton ────────────────────────────────────────────────

/**
 * Глобальный singleton-экземпляр Nova Framework.
 * @type {Nova}
 */
const nova = Nova.getInstance();


// ─── ESM Exports ──────────────────────────────────────────────

export {
  Nova,
  NovaUtils,
  NovaDOM,
  NovaModal,
  NovaDropdown,
  NovaToast,
  NovaTabs,
  NovaCollapse,
  NovaCarousel,
  NovaTooltip,
};

export default nova;


// ─── Глобальный доступ (UMD / <script>) ──────────────────────

if (typeof window !== 'undefined') {
  window.Nova          = Nova;
  window.nova          = nova;
  window.NovaUtils     = NovaUtils;
  window.NovaDOM       = NovaDOM;
  window.NovaModal     = NovaModal;
  window.NovaDropdown  = NovaDropdown;
  window.NovaToast     = NovaToast;
  window.NovaTabs      = NovaTabs;
  window.NovaCollapse  = NovaCollapse;
  window.NovaCarousel  = NovaCarousel;
  window.NovaTooltip   = NovaTooltip;
}