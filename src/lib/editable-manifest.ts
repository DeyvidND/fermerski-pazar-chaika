// src/lib/editable-manifest.ts
/**
 * Single source of truth for what is editable on this storefront. The admin
 * „Промени сайта" panel reads the serialized form (editable-manifest.json) and
 * renders its editor from it; CopySlot/MediaSlot read defaults/labels from here.
 * Add a slot = add it to a section below + drop <CopySlot slot="…"/> /
 * <MediaSlot slot="…"/> into the markup. Add a page = add a Page entry + wrap
 * its sections with data-copy-section. Slot keys must match the stored override
 * keys (settings.copy / settings.media) — never rename a shipped key.
 */
export interface TextSlot { kind: 'text'; key: string; label: string; default: string; multiline?: boolean }
export interface ImageSlot { kind: 'image'; key: string; label: string; ratio: string; rounded?: boolean; note?: string }
export type Slot = TextSlot | ImageSlot;
export interface Section { id: string; label: string; slots: Slot[] }
export interface Page { route: string; label: string; sections: Section[]; faq?: boolean }
export interface EditableManifest { theme: string; pages: Page[] }

export const MANIFEST: EditableManifest = {
  theme: 'pazar',
  pages: [
    {
      route: '/', label: 'Начало',
      sections: [
        // Site-wide header + footer chrome (renders on every page). Defaults are
        // empty where the real source is dynamic (brand name = storefront.name,
        // footer about = contactTagline) — CopySlot's `fallback` prop supplies it.
        { id: 'site.chrome', label: 'Хедър и футър (цял сайт)', slots: [
          { kind: 'text', key: 'site.brand.name', label: 'Лого · име', default: '' },
          { kind: 'text', key: 'site.brand.tag', label: 'Лого · подзаглавие', default: 'Фермерски пазар · Чайка, Варна' },
          { kind: 'text', key: 'site.footer.about', label: 'Футър · описание', multiline: true, default: '' },
          { kind: 'text', key: 'site.footer.col_shop', label: 'Футър · колона „Пазарувай“', default: 'Пазарувай' },
          { kind: 'text', key: 'site.footer.col_info', label: 'Футър · колона „Информация“', default: 'Информация' },
          { kind: 'text', key: 'site.footer.col_contact', label: 'Футър · колона „Пазар & контакти“', default: 'Пазар & контакти' },
          { kind: 'text', key: 'site.footer.copyright', label: 'Футър · долен ред (след името)', default: 'Фермерски пазар Чайка, Варна.' },
          { kind: 'text', key: 'site.footer.login_label', label: 'Футър · линк „Вход за стопани“', default: 'Вход за стопани' },
          { kind: 'text', key: 'site.footer.rights', label: 'Футър · „Всички права запазени“', default: 'Всички права запазени.' },
        ]},
        { id: 'home.hero', label: 'Hero', slots: [
          { kind: 'text', key: 'home.hero.eyebrow', label: 'Hero · надпис отгоре', default: 'Фермерски пазар · кв. Чайка, Варна' },
          { kind: 'text', key: 'home.hero.title', label: 'Hero · заглавие', default: 'Свежа храна директно от фермерите' },
          { kind: 'text', key: 'home.hero.lead', label: 'Hero · текст', multiline: true, default: 'Ела на живо всеки петък на Чайка или поръчай онлайн — плодове, мляко, мед, месо и домашни сладка с доставка до дома.' },
          { kind: 'image', key: 'home.hero', label: 'Главна снимка (hero)', ratio: '4/5', rounded: true },
          { kind: 'text', key: 'home.hero.stat1.n', label: 'Hero · показател 1 — горе', default: 'Петък' },
          { kind: 'text', key: 'home.hero.stat1.l', label: 'Hero · показател 1 — отдолу', default: 'пазар на живо · Чайка' },
          { kind: 'text', key: 'home.hero.stat2.l', label: 'Hero · показател 2 — отдолу (броят е автоматичен)', default: 'категории продукти' },
          { kind: 'text', key: 'home.hero.stat3.n', label: 'Hero · показател 3 — горе', default: '100% българско' },
          { kind: 'text', key: 'home.hero.stat3.l', label: 'Hero · показател 3 — отдолу', default: 'местно от региона' },
        ]},
        { id: 'home.twoways', label: 'Два начина да пазаруваш', slots: [
          { kind: 'text', key: 'home.twoways.eyebrow', label: 'Два начина · надпис', default: 'Два начина да пазаруваш' },
          { kind: 'text', key: 'home.twoways.title', label: 'Два начина · заглавие', default: 'На пазара или онлайн — ти избираш' },
          { kind: 'text', key: 'home.pillar_market.title', label: 'Стълб „Пазар" · заглавие', default: 'Пазар на място' },
          { kind: 'text', key: 'home.pillar_market.text', label: 'Стълб „Пазар" · текст', multiline: true, default: 'Всеки петък фермерите се събират на Чайка. Опитай, разгледай и вземи директно от стопанина — без посредник.' },
          { kind: 'text', key: 'home.pillar_market.fact1', label: 'Стълб „Пазар" · ред 1 (адрес)', default: 'кв. Чайка, бул. „Ал. Стамболийски" (пред „Фратели")' },
          { kind: 'text', key: 'home.pillar_market.fact2', label: 'Стълб „Пазар" · ред 2 (часове)', default: 'Всеки петък · 11:00–18:00' },
          { kind: 'image', key: 'site.pillar_market', label: '„Пазар на място" · щандове', ratio: '16/10', note: 'Показва се и на страница „Поръчки"' },
          { kind: 'text', key: 'home.pillar_delivery.title', label: 'Стълб „Доставка" · заглавие', default: 'Доставка до дома' },
          { kind: 'text', key: 'home.pillar_delivery.text', label: 'Стълб „Доставка" · текст', multiline: true, default: 'Запази продукти от сайта и ги получи удобно вкъщи. Поръчай онлайн, а ние ги доставяме свежи в петък.' },
          { kind: 'text', key: 'home.pillar_delivery.fact1', label: 'Стълб „Доставка" · ред 1 (часове)', default: 'Доставка в петък · между 11:00 и 20:00 ч.' },
          { kind: 'text', key: 'home.pillar_delivery.fact2', label: 'Стълб „Доставка" · ред 2', default: 'Свежо, директно от щанда до вратата ти' },
          { kind: 'image', key: 'site.pillar_delivery', label: '„Доставка до дома" · кашон', ratio: '16/10', note: 'Показва се и на страница „Поръчки"' },
        ]},
        { id: 'home.categories', label: 'Категории', slots: [
          { kind: 'text', key: 'home.categories.eyebrow', label: 'Категории · надпис', default: 'Пазарувай по категория' },
          { kind: 'text', key: 'home.categories.title', label: 'Категории · заглавие', default: 'Какво ще намериш' },
        ]},
        { id: 'home.farmers', label: 'Фермери', slots: [
          { kind: 'text', key: 'home.farmers.eyebrow', label: 'Фермери · надпис', default: 'Хора зад щандовете' },
          { kind: 'text', key: 'home.farmers.title', label: 'Фермери · заглавие', default: 'Запознай се с фермерите' },
        ]},
        { id: 'home.latest', label: 'Предложения', slots: [
          { kind: 'text', key: 'home.latest.eyebrow', label: 'Предложения · надпис', default: 'Свежо този петък' },
          { kind: 'text', key: 'home.latest.title', label: 'Предложения · заглавие', default: 'Най-актуални предложения' },
        ]},
        { id: 'home.reviews', label: 'Отзиви', slots: [
          { kind: 'text', key: 'home.reviews.eyebrow', label: 'Отзиви · надпис', default: 'Отзиви' },
          { kind: 'text', key: 'home.reviews.title', label: 'Отзиви · заглавие', default: 'Какво казват клиентите' },
        ]},
        { id: 'home.how', label: 'Как е подреден магазинът', slots: [
          { kind: 'text', key: 'home.how.eyebrow', label: 'Как работи · надпис', default: 'Как е подреден магазинът' },
          { kind: 'text', key: 'home.how.title', label: 'Как работи · заглавие', default: 'Фермер → категория → продукт' },
          { kind: 'text', key: 'home.how.text', label: 'Как работи · текст', multiline: true, default: 'Всеки продукт идва от конкретен фермер и е подреден в категория. Така знаеш точно кой стопанин стои зад храната ти.' },
          { kind: 'text', key: 'home.how.s1.title', label: 'Как работи · стъпка 1 заглавие', default: '1 · Избираш фермер' },
          { kind: 'text', key: 'home.how.s1.text', label: 'Как работи · стъпка 1 текст', multiline: true, default: 'Всяко стопанство има профил със снимка, история и собствен асортимент.' },
          { kind: 'text', key: 'home.how.s2.title', label: 'Как работи · стъпка 2 заглавие', default: '2 · Разглеждаш категориите' },
          { kind: 'text', key: 'home.how.s2.text', label: 'Как работи · стъпка 2 текст', multiline: true, default: 'Продуктите на фермера са групирани по категории — плодове, мляко, мед, месо, сладка.' },
          { kind: 'text', key: 'home.how.s3.title', label: 'Как работи · стъпка 3 заглавие', default: '3 · Поръчваш продукта' },
          { kind: 'text', key: 'home.how.s3.text', label: 'Как работи · стъпка 3 текст', multiline: true, default: 'Добавяш в количката директно от категорията или запазваш за петъчния пазар.' },
        ]},
        { id: 'home.location', label: 'Локация', slots: [
          { kind: 'text', key: 'home.location.eyebrow', label: 'Локация · надпис', default: 'Локация' },
          { kind: 'text', key: 'home.location.title', label: 'Локация · заглавие', default: 'Фермерски пазар — Чайка' },
          { kind: 'text', key: 'home.location.lead', label: 'Локация · текст', multiline: true, default: 'Намираш ни в кв. Чайка, Варна — на бул. „Ал. Стамболийски", точно пред „Фратели".' },
          { kind: 'text', key: 'home.location.fact1.title', label: 'Локация · факт 1 — адрес', default: 'кв. Чайка, бул. „Ал. Стамболийски"' },
          { kind: 'text', key: 'home.location.fact1.sub', label: 'Локация · факт 1 — под адреса', default: 'пред „Фратели", гр. Варна' },
          { kind: 'text', key: 'home.location.fact2.title', label: 'Локация · факт 2 — пазар', default: 'Всеки петък · 11:00–18:00' },
          { kind: 'text', key: 'home.location.fact2.sub', label: 'Локация · факт 2 — под пазара', default: 'пазар на живо с фермерите' },
          { kind: 'text', key: 'home.location.fact3.title', label: 'Локация · факт 3 — доставка', default: 'Доставка в петък · 11:00–20:00 ч.' },
          { kind: 'text', key: 'home.location.fact3.sub', label: 'Локация · факт 3 — под доставка', default: 'за онлайн поръчки до адрес' },
        ]},
        { id: 'home.newsletter', label: 'Бюлетин', slots: [
          { kind: 'text', key: 'home.newsletter.title', label: 'Бюлетин · заглавие', default: 'Какво има на пазара тази седмица?' },
          { kind: 'text', key: 'home.newsletter.text', label: 'Бюлетин · текст', multiline: true, default: 'Абонирай се и получавай в четвъртък какво носят фермерите в петък. Без спам.' },
        ]},
      ],
    },
    {
      route: '/about', label: 'За нас',
      sections: [
        { id: 'about.hero', label: 'Hero', slots: [
          { kind: 'text', key: 'about.hero.eyebrow', label: 'Hero · надпис', default: 'За нас' },
          { kind: 'text', key: 'about.hero.title', label: 'Hero · заглавие', multiline: true, default: 'Един пазар,\nмного местни\nстопани' },
          { kind: 'text', key: 'about.hero.lead', label: 'Hero · текст', multiline: true, default: 'събира фермерите от региона на Варна на едно място — всеки петък на Чайка. Тук храната не минава през вериги и складове. Купуваш я директно от човека, който я е отгледал.' },
          { kind: 'image', key: 'about.portrait', label: 'Пазарът на Чайка (портрет)', ratio: '4/5', rounded: true },
        ]},
        { id: 'about.story', label: 'История', slots: [
          { kind: 'text', key: 'about.story.p1', label: 'История · параграф 1', multiline: true, default: 'Започнахме като малка сбирка от няколко съседни стопанства, които искаха да продават директно на хората — без посредник, без етикети, които никой не разбира. Първите петъци на Чайка бяхме шепа маси и кошници. Хората се връщаха. После водеха приятели.' },
          { kind: 'text', key: 'about.story.p2', label: 'История · параграф 2', multiline: true, default: 'Днес на пазара се събират фермери с плодове и зеленчуци, мляко и сирене, мед, месо и домашни сладка. Различни стопанства, но един и същ принцип — местно, сезонно и честно. Каквото е узряло тази седмица, това носим.' },
          { kind: 'text', key: 'about.story.p3', label: 'История · параграф 3', multiline: true, default: 'Сайтът добавихме, за да е по-лесно: разглеждаш фермерите и продуктите им предварително, запазваш онлайн и идваш да вземеш — или избираш доставка до дома. Така пазарът работи и през останалите дни от седмицата.' },
        ]},
        { id: 'about.values', label: 'Ценности', slots: [
          { kind: 'text', key: 'about.values.eyebrow', label: 'Ценности · надпис', default: 'Нашите ценности' },
          { kind: 'text', key: 'about.values.title', label: 'Ценности · заглавие', default: 'В какво вярваме' },
          { kind: 'text', key: 'about.values.1.title', label: 'Ценности · карта 1 заглавие', default: 'Местно и сезонно' },
          { kind: 'text', key: 'about.values.1.text', label: 'Ценности · карта 1 текст', multiline: true, default: 'Продукти от региона на Варна — толкова свежи, колкото е възможно.' },
          { kind: 'text', key: 'about.values.2.title', label: 'Ценности · карта 2 заглавие', default: 'Директно от фермера' },
          { kind: 'text', key: 'about.values.2.text', label: 'Ценности · карта 2 текст', multiline: true, default: 'Без вериги и посредници — парите отиват при стопанина.' },
          { kind: 'text', key: 'about.values.3.title', label: 'Ценности · карта 3 заглавие', default: 'Общност' },
          { kind: 'text', key: 'about.values.3.text', label: 'Ценности · карта 3 текст', multiline: true, default: 'Познаваме си хората — стопани и клиенти, които се срещат всеки петък.' },
          { kind: 'text', key: 'about.values.4.title', label: 'Ценности · карта 4 заглавие', default: 'Честно и ясно' },
          { kind: 'text', key: 'about.values.4.text', label: 'Ценности · карта 4 текст', multiline: true, default: 'Знаеш кой, къде и как е произвел това, което купуваш.' },
        ]},
        { id: 'about.gallery', label: 'Галерия', slots: [
          { kind: 'text', key: 'about.gallery.eyebrow', label: 'Галерия · надпис', default: 'От пазара' },
          { kind: 'text', key: 'about.gallery.title', label: 'Галерия · заглавие', default: 'Един петък на Чайка' },
          { kind: 'image', key: 'about.gallery_stalls', label: 'Галерия · Щандовете на пазара', ratio: '2/1' },
          { kind: 'image', key: 'about.gallery_basket', label: 'Галерия · Кошница с плодове', ratio: '1/1' },
          { kind: 'image', key: 'about.gallery_honey', label: 'Галерия · Буркани с мед', ratio: '1/2' },
          { kind: 'image', key: 'about.gallery_dairy', label: 'Галерия · Сирене и мляко', ratio: '1/1' },
          { kind: 'image', key: 'about.gallery_farmer', label: 'Галерия · Фермер на щанда', ratio: '1/1' },
          { kind: 'image', key: 'about.gallery_sweets', label: 'Галерия · Домашни сладка', ratio: '1/1' },
          { kind: 'image', key: 'about.gallery_customers', label: 'Галерия · Клиенти на пазара', ratio: '1/1' },
        ]},
        { id: 'about.quote', label: 'Цитат', slots: [
          { kind: 'text', key: 'about.quote', label: 'Цитат', multiline: true, default: 'Не продаваме просто храна. Свързваме хората, които я отглеждат, с хората, които я ядат — лице в лице, всеки петък."' },
        ]},
      ],
    },
    {
      route: '/orders', label: 'Поръчки',
      sections: [
        { id: 'orders.head', label: 'Заглавна', slots: [
          { kind: 'text', key: 'orders.head.eyebrow', label: 'Заглавна · надпис', default: 'Поръчки' },
          { kind: 'text', key: 'orders.head.title', label: 'Заглавна · заглавие', default: 'Как стига храната до теб' },
          { kind: 'text', key: 'orders.head.text', label: 'Заглавна · текст', multiline: true, default: 'Два начина да вземеш продуктите от фермерите — ела на пазара на Чайка всеки петък, или запази онлайн и получи доставка до дома. Ти избираш.' },
        ]},
        { id: 'orders.pickup', label: 'Вземане от пазара', slots: [
          { kind: 'text', key: 'orders.pickup.title', label: 'Вземане · заглавие', default: 'Вземане от пазара' },
          { kind: 'text', key: 'orders.pickup.text', label: 'Вземане · текст', multiline: true, default: 'Запази продуктите си онлайн и ги вземи лично в петък от щандовете на Чайка — без такса за доставка.' },
          { kind: 'text', key: 'orders.pickup.fact1', label: 'Вземане · ред 1 (адрес)', default: 'кв. Чайка, бул. „Ал. Стамболийски" (пред „Фратели")' },
          { kind: 'text', key: 'orders.pickup.fact2', label: 'Вземане · ред 2 (часове)', default: 'Всеки петък · 11:00–18:00' },
          { kind: 'text', key: 'orders.pickup.fact3', label: 'Вземане · ред 3', default: 'Без такса · плащаш на място' },
        ]},
        { id: 'orders.delivery', label: 'Доставка до адрес', slots: [
          { kind: 'text', key: 'orders.delivery.title', label: 'Доставка · заглавие', default: 'Доставка до адрес' },
          { kind: 'text', key: 'orders.delivery.text', label: 'Доставка · текст', multiline: true, default: 'Поръчай онлайн и получи свежите продукти удобно вкъщи в петък между 11:00 и 20:00 ч.' },
          { kind: 'text', key: 'orders.delivery.fact1', label: 'Доставка · ред 1 (часове)', default: 'Доставка в петък · 11:00–20:00 ч.' },
          { kind: 'text', key: 'orders.delivery.fact2', label: 'Доставка · ред 2 (район)', default: 'Варна и близките квартали' },
          { kind: 'text', key: 'orders.delivery.fact3', label: 'Доставка · ред 3 (такса)', default: 'Безплатна доставка над 40,00 € (78,23 лв.)' },
        ]},
        { id: 'orders.steps', label: 'Стъпки', slots: [
          { kind: 'text', key: 'orders.steps.eyebrow', label: 'Стъпки · надпис', default: 'Стъпка по стъпка' },
          { kind: 'text', key: 'orders.steps.title', label: 'Стъпки · заглавие', default: 'Поръчката за 4 стъпки' },
          { kind: 'text', key: 'orders.steps.1.title', label: 'Стъпка 1 · заглавие', default: '1 · Разгледай' },
          { kind: 'text', key: 'orders.steps.1.text', label: 'Стъпка 1 · текст', multiline: true, default: 'Избери фермер или категория и виж какво е свежо тази седмица.' },
          { kind: 'text', key: 'orders.steps.2.title', label: 'Стъпка 2 · заглавие', default: '2 · Добави' },
          { kind: 'text', key: 'orders.steps.2.text', label: 'Стъпка 2 · текст', multiline: true, default: 'Сложи продуктите в количката и избери количество.' },
          { kind: 'text', key: 'orders.steps.3.title', label: 'Стъпка 3 · заглавие', default: '3 · Избери начин' },
          { kind: 'text', key: 'orders.steps.3.text', label: 'Стъпка 3 · текст', multiline: true, default: 'Вземане от пазара на Чайка или доставка до адрес.' },
          { kind: 'text', key: 'orders.steps.4.title', label: 'Стъпка 4 · заглавие', default: '4 · Готово' },
          { kind: 'text', key: 'orders.steps.4.text', label: 'Стъпка 4 · текст', multiline: true, default: 'Потвърждаваме поръчката и я приготвяме за петък.' },
        ]},
        { id: 'orders.know', label: 'Добре е да знаеш', slots: [
          { kind: 'text', key: 'orders.know.eyebrow', label: 'Добре е да знаеш · надпис', default: 'Доставка и плащане' },
          { kind: 'text', key: 'orders.know.title', label: 'Добре е да знаеш · заглавие', default: 'Добре е да знаеш' },
          { kind: 'text', key: 'orders.know.fact1.title', label: 'Добре е да знаеш · факт 1 (главен)', default: 'Краен срок за поръчки — четвъртък 20:00 ч.' },
          { kind: 'text', key: 'orders.know.fact1.sub', label: 'Добре е да знаеш · факт 1 (под)', default: 'за да влязат в петъчната доставка' },
          { kind: 'text', key: 'orders.know.fact2.title', label: 'Добре е да знаеш · факт 2 (главен)', default: 'Доставка в петък · 11:00–20:00 ч.' },
          { kind: 'text', key: 'orders.know.fact2.sub', label: 'Добре е да знаеш · факт 2 (под)', default: 'куриерът се обажда преди да пристигне' },
          { kind: 'image', key: 'orders.box', label: 'Кашон с поръчка', ratio: '4/3', rounded: true },
        ]},
      ],
    },
    {
      route: '/contact', label: 'Контакти',
      sections: [
        { id: 'contact.head', label: 'Заглавна', slots: [
          { kind: 'text', key: 'contact.head.eyebrow', label: 'Заглавна · надпис', default: 'Контакти' },
          { kind: 'text', key: 'contact.head.title', label: 'Заглавна · заглавие', default: 'Ще се радваме да чуем' },
          { kind: 'text', key: 'contact.head.text', label: 'Заглавна · текст', multiline: true, default: 'Въпрос за поръчка, продукт от пазара или просто здравей — пиши ни по който начин ти е удобен. Ще се радваме да те видим и на живо в петък на Чайка.' },
        ]},
        { id: 'contact.form', label: 'Форма', slots: [
          { kind: 'text', key: 'contact.form.title', label: 'Форма · заглавие', default: 'Изпрати съобщение' },
          { kind: 'text', key: 'contact.form.note', label: 'Форма · бележка', default: 'Отговаряме в рамките на работния ден.' },
        ]},
      ],
    },
    {
      route: '/faq', label: 'FAQ', faq: true,
      sections: [
        { id: 'faq.head', label: 'Заглавна', slots: [
          { kind: 'text', key: 'faq.head.eyebrow', label: 'Надпис', default: 'Често задавани въпроси' },
          { kind: 'text', key: 'faq.head.title', label: 'Заглавие', default: 'Каквото обикновено ни питат' },
        ]},
      ],
    },
    {
      route: '/shop', label: 'Магазин',
      sections: [
        { id: 'shop.head', label: 'Заглавна', slots: [
          { kind: 'text', key: 'shop.head.eyebrow', label: 'Надпис', default: 'Магазин' },
          { kind: 'text', key: 'shop.head.title', label: 'Заглавие', default: 'Всичко от пазара на едно място' },
          { kind: 'text', key: 'shop.head.text', label: 'Текст', multiline: true, default: 'Избери категория. Продуктите идват от местните фермери и се запазват за петъчния пазар или за доставка до дома.' },
        ]},
      ],
    },
    {
      route: '/reviews', label: 'Отзиви',
      sections: [
        { id: 'reviews.head', label: 'Заглавна', slots: [
          { kind: 'text', key: 'reviews.head.eyebrow', label: 'Надпис', default: 'Отзиви' },
          { kind: 'text', key: 'reviews.head.title', label: 'Заглавие', default: 'Какво казват клиентите' },
          { kind: 'text', key: 'reviews.head.text', label: 'Текст', multiline: true, default: 'Истински думи от хората, които пазаруват при нас на Чайка. Поръчвал/а си? Сподели и ти впечатленията си по-долу.' },
        ]},
        { id: 'reviews.form', label: 'Форма за ревю', slots: [
          { kind: 'text', key: 'reviews.form.title', label: 'Заглавие', default: 'Остави ревю' },
          { kind: 'text', key: 'reviews.form.note', label: 'Бележка', multiline: true, default: 'Поръчвал/а си от нас? Сподели впечатленията си — помага на други да изберат.' },
        ]},
        { id: 'reviews.all', label: 'Всички отзиви', slots: [
          { kind: 'text', key: 'reviews.all.eyebrow', label: 'Надпис', default: 'Всички отзиви' },
        ]},
      ],
    },
    {
      route: '/farmers', label: 'Фермери',
      sections: [
        { id: 'farmers.head', label: 'Заглавна', slots: [
          { kind: 'text', key: 'farmers.head.eyebrow', label: 'Надпис', default: 'Хора зад щандовете' },
          { kind: 'text', key: 'farmers.head.title', label: 'Заглавие', default: 'Нашите фермери' },
          { kind: 'text', key: 'farmers.head.text', label: 'Текст', multiline: true, default: 'Местни семейни стопанства от региона на Варна. Всеки фермер има своя страница с продукти, подредени по категории — избери чие стопанство да разгледаш.' },
        ]},
        { id: 'farmers.how', label: 'Как е подреден магазинът', slots: [
          { kind: 'text', key: 'farmers.how.eyebrow', label: 'Надпис', default: 'Как е подреден магазинът' },
          { kind: 'text', key: 'farmers.how.title', label: 'Заглавие', default: 'Фермер → категория → продукт' },
          { kind: 'text', key: 'farmers.how.s1.title', label: 'Стъпка 1 · заглавие', default: '1 · Избираш фермер' },
          { kind: 'text', key: 'farmers.how.s1.text', label: 'Стъпка 1 · текст', multiline: true, default: 'Всяко стопанство има профил със снимка, история и собствен асортимент.' },
          { kind: 'text', key: 'farmers.how.s2.title', label: 'Стъпка 2 · заглавие', default: '2 · Разглеждаш категориите' },
          { kind: 'text', key: 'farmers.how.s2.text', label: 'Стъпка 2 · текст', multiline: true, default: 'Продуктите на фермера са групирани по категории — плодове, мляко, мед, месо, сладка.' },
          { kind: 'text', key: 'farmers.how.s3.title', label: 'Стъпка 3 · заглавие', default: '3 · Поръчваш продукта' },
          { kind: 'text', key: 'farmers.how.s3.text', label: 'Стъпка 3 · текст', multiline: true, default: 'Добавяш в количката директно от категорията. Всичко идва от едно стопанство.' },
        ]},
      ],
    },
    {
      route: '/articles', label: 'Статии',
      sections: [
        { id: 'articles.head', label: 'Заглавна', slots: [
          { kind: 'text', key: 'articles.head.eyebrow', label: 'Надпис', default: 'Статии' },
          { kind: 'text', key: 'articles.head.title', label: 'Заглавие', default: 'Новини и истории от фермата' },
          { kind: 'text', key: 'articles.head.text', label: 'Текст', multiline: true, default: 'Рецепти, съвети и истории зад продуктите.' },
        ]},
      ],
    },
  ],
};

/** Flat key → slot lookup, derived once. */
export const SLOTS: Record<string, Slot> = Object.fromEntries(
  MANIFEST.pages.flatMap((p) => p.sections.flatMap((s) => s.slots.map((sl) => [sl.key, sl] as const))),
);

/** Section id for a slot key (for data-copy-section / preview scroll). */
export const SECTION_OF: Record<string, string> = Object.fromEntries(
  MANIFEST.pages.flatMap((p) => p.sections.flatMap((s) => s.slots.map((sl) => [sl.key, s.id] as const))),
);

/** Resolve a text slot's current value outside JSX (e.g. Layout.astro's meta
 *  description) with the same precedence CopySlot uses: tenant override →
 *  manifest default → fallback. Keeps things like the og:description in sync
 *  with whatever the owner actually edited, instead of a second hand-written
 *  string that silently drifts from the real page copy. */
export function resolveSlot(copy: Record<string, string> | null | undefined, slot: string, fallback = ''): string {
  const def = SLOTS[slot];
  const manifestDefault = def && def.kind === 'text' ? def.default : '';
  const raw = copy?.[slot];
  return typeof raw === 'string' && raw.trim() ? raw : manifestDefault || fallback;
}
