import type { CountryCode, StandAddress, StandAddressFields } from './types'

/**
 * Адресная книга пользователя с сохранёнными адресами.
 *
 * Состав одинаковый во всех странах — так концепты сравниваются на равных:
 * четыре адреса курьерской доставки, три платных и один бесплатный.
 *
 * Пунктов выдачи в книге нет намеренно. Задание сохранённого пользователя —
 * забрать заказ самому, и пока в книге лежали готовые пункты, респонденты
 * просто выбирали один из них: сценарий заканчивался на втором клике, а
 * добавление нового способа доставки — то, ради чего задание и придумано, —
 * не проверялся ни разу. Теперь пункт приходится добавлять.
 *
 * Доставка курьером на всех рынках бесплатна — платным остался только
 * экспресс, и выбирают его в блоке вариантов, а не в адресной книге.
 * Поэтому у карточек книги цены нет.
 *
 * Форматы адресов, имена и телефоны — местные. Респондент должен читать
 * карточку как свою, иначе проверяется не интерфейс, а способность
 * разобрать чужой формат адреса.
 */

/**
 * Значения полей адреса. Ключи совпадают с FieldKey — это те же поля,
 * которые отдаёт useStandFields, только уже заполненные.
 *
 * Заполнены ровно те, что есть в форме этой страны: в России — подъезд,
 * этаж и домофон, в США — штат. Лишние остаются пустыми и в форму
 * не попадают.
 *
 * Дом в России вынесен отдельным полем (см. countries.ts), поэтому там он
 * приходит в extra, а в строке улицы его нет: иначе при редактировании
 * сохранённого адреса одно и то же число стоит на экране дважды. На
 * остальных рынках отдельного поля нет, и дом живёт внутри строки.
 */
function fields(
  street: string,
  apartment: string,
  postal: string,
  city: string,
  extra: Partial<StandAddressFields> = {},
): StandAddressFields {
  return {
    addressLabel: 'home',
    house: '',
    street,
    apartment,
    entrance: '',
    floor: '',
    intercom: '',
    postal,
    city,
    region: '',
    comment: '',
    ...extra,
  }
}

export const addressBook: Record<CountryCode, StandAddress[]> = {
  ru: [
    {
      id: 'ru-courier-berezovoy',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      badgeKey: 'address.badge.last',
      recipientName: 'Иванов Иван Иванович',
      phone: '+7 999 111-22-33',
      email: 'qa.auto.checkout+ru@example.com',
      city: 'Москва',
      addressLine: 'проспект Берёзовой Рощи, 12, Москва, 125252',
      address: fields('Москва, проспект Берёзовой Рощи', '45', '125252', 'Москва', {
        house: '12',
        entrance: '2',
        floor: '5',
        intercom: '45К',
        comment: 'Код от подъезда 1234',
      }),
      price: 0,
    },
    {
      id: 'ru-courier-leningradsky',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Иванова Мария Петровна',
      phone: '+7 999 222-33-44',
      email: 'qa.auto.checkout+ru@example.com',
      city: 'Москва',
      addressLine: 'Ленинградский проспект, 80, Москва, 125315',
      address: fields('Москва, Ленинградский проспект', '12', '125315', 'Москва', {
        house: '80',
        addressLabel: 'work',
        entrance: '1',
        floor: '3',
      }),
      price: 0,
    },
    {
      id: 'ru-courier-kutuzovsky',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Петров Сергей Николаевич',
      phone: '+7 999 333-44-55',
      email: 'qa.auto.checkout+ru@example.com',
      city: 'Москва',
      addressLine: 'Кутузовский проспект, 24, Москва, 121165',
      address: fields('Москва, Кутузовский проспект', '3', '121165', 'Москва', {
        house: '24',
        addressLabel: 'custom',
        entrance: '4',
        floor: '2',
        intercom: '3В',
      }),
      price: 0,
    },
    {
      id: 'ru-courier-profsoyuznaya',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Иванов Иван Иванович',
      phone: '+7 999 111-22-33',
      email: 'qa.auto.checkout+ru@example.com',
      city: 'Москва',
      addressLine: 'Профсоюзная улица, 104, Москва, 117321',
      address: fields('Москва, Профсоюзная улица', '77', '117321', 'Москва', {
        house: '104',
        entrance: '1',
        floor: '9',
      }),
      price: 0,
    },
  ],

  kz: [
    {
      id: 'kz-courier-abaya',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      badgeKey: 'address.badge.last',
      recipientName: 'Ахметов Данияр Маратович',
      phone: '+7 701 111-22-33',
      email: 'qa.auto.checkout+kz@example.com',
      city: 'Алматы',
      addressLine: 'ул. Абая, 150, Алматы, 050009',
      address: fields('Алматы, ул. Абая, 150', '25', '050009', 'Алматы', {
        entrance: '3',
        floor: '7',
        intercom: '25',
      }),
      price: 0,
    },
    {
      id: 'kz-courier-dostyk',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Смагулова Айгуль Ерлановна',
      phone: '+7 701 222-33-44',
      email: 'qa.auto.checkout+kz@example.com',
      city: 'Алматы',
      addressLine: 'пр. Достык, 89, Алматы, 050051',
      address: fields('Алматы, пр. Достык, 89', '14', '050051', 'Алматы', {
        addressLabel: 'work',
        entrance: '1',
        floor: '4',
      }),
      price: 0,
    },
    {
      id: 'kz-courier-zhandosova',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Ким Сергей Владимирович',
      phone: '+7 701 333-44-55',
      email: 'qa.auto.checkout+kz@example.com',
      city: 'Алматы',
      addressLine: 'ул. Жандосова, 58, Алматы, 050035',
      address: fields('Алматы, ул. Жандосова, 58', '7', '050035', 'Алматы', {
        addressLabel: 'custom',
        floor: '2',
      }),
      price: 0,
    },
    {
      id: 'kz-courier-samal',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Ахметов Данияр Маратович',
      phone: '+7 701 111-22-33',
      email: 'qa.auto.checkout+kz@example.com',
      city: 'Алматы',
      addressLine: 'мкр. Самал-2, 33, Алматы, 050051',
      address: fields('Алматы, мкр. Самал-2, 33', '18', '050051', 'Алматы', {
        entrance: '2',
        floor: '6',
      }),
      price: 0,
    },
  ],

  de: [
    {
      id: 'de-courier-kastanienallee',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      badgeKey: 'address.badge.last',
      recipientName: 'Anna Schmidt',
      phone: '+49 151 1112233',
      email: 'qa.auto.checkout+de@example.com',
      city: 'Berlin',
      addressLine: 'Kastanienallee 42, 10435 Berlin',
      address: fields('Kastanienallee 42', '3. OG', '10435', 'Berlin'),
      price: 0,
    },
    {
      id: 'de-courier-friedrichstrasse',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Michael Weber',
      phone: '+49 151 2223344',
      email: 'qa.auto.checkout+de@example.com',
      city: 'Berlin',
      addressLine: 'Friedrichstraße 120, 10117 Berlin',
      address: fields('Friedrichstraße 120', '', '10117', 'Berlin'),
      price: 0,
    },
    {
      id: 'de-courier-karl-marx-allee',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Julia Becker',
      phone: '+49 151 3334455',
      email: 'qa.auto.checkout+de@example.com',
      city: 'Berlin',
      addressLine: 'Karl-Marx-Allee 78, 10243 Berlin',
      address: fields('Karl-Marx-Allee 78', '12', '10243', 'Berlin'),
      price: 0,
    },
    {
      id: 'de-courier-schoenhauser',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Anna Schmidt',
      phone: '+49 151 1112233',
      email: 'qa.auto.checkout+de@example.com',
      city: 'Berlin',
      addressLine: 'Schönhauser Allee 36, 10435 Berlin',
      address: fields('Schönhauser Allee 36', '2. OG', '10435', 'Berlin'),
      price: 0,
    },
  ],

  pl: [
    {
      id: 'pl-courier-marszalkowska',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      badgeKey: 'address.badge.last',
      recipientName: 'Anna Kowalska',
      phone: '+48 501 111 222',
      email: 'qa.auto.checkout+pl@example.com',
      city: 'Warszawa',
      addressLine: 'ul. Marszałkowska 84/92, 00-514 Warszawa',
      address: fields('ul. Marszałkowska 84/92', 'm. 15', '00-514', 'Warszawa'),
      price: 0,
    },
    {
      id: 'pl-courier-pulawska',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Piotr Nowak',
      phone: '+48 501 222 333',
      email: 'qa.auto.checkout+pl@example.com',
      city: 'Warszawa',
      addressLine: 'ul. Puławska 42, 02-508 Warszawa',
      address: fields('ul. Puławska 42', 'm. 8', '02-508', 'Warszawa'),
      price: 0,
    },
    {
      id: 'pl-courier-jerozolimskie',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Magdalena Wiśniewska',
      phone: '+48 501 333 444',
      email: 'qa.auto.checkout+pl@example.com',
      city: 'Warszawa',
      addressLine: 'al. Jerozolimskie 123, 02-017 Warszawa',
      address: fields('al. Jerozolimskie 123', 'm. 30', '02-017', 'Warszawa'),
      price: 0,
    },
    {
      id: 'pl-courier-krucza',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Anna Kowalska',
      phone: '+48 501 111 222',
      email: 'qa.auto.checkout+pl@example.com',
      city: 'Warszawa',
      addressLine: 'ul. Krucza 16/22, 00-526 Warszawa',
      address: fields('ul. Krucza 16/22', 'm. 4', '00-526', 'Warszawa'),
      price: 0,
    },
  ],

  cz: [
    {
      id: 'cz-courier-vinohradska',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      badgeKey: 'address.badge.last',
      recipientName: 'Jana Nováková',
      phone: '+420 601 111 222',
      email: 'qa.auto.checkout+cz@example.com',
      city: 'Praha',
      addressLine: 'Vinohradská 112, 130 00 Praha 3',
      address: fields('Vinohradská 112', 'byt 9', '130 00', 'Praha 3'),
      price: 0,
    },
    {
      id: 'cz-courier-korunni',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Petr Svoboda',
      phone: '+420 601 222 333',
      email: 'qa.auto.checkout+cz@example.com',
      city: 'Praha',
      addressLine: 'Korunní 58, 120 00 Praha 2',
      address: fields('Korunní 58', '', '120 00', 'Praha 2'),
      price: 0,
    },
    {
      id: 'cz-courier-sokolovska',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Lucie Dvořáková',
      phone: '+420 601 333 444',
      email: 'qa.auto.checkout+cz@example.com',
      city: 'Praha',
      addressLine: 'Sokolovská 200, 190 00 Praha 9',
      address: fields('Sokolovská 200', 'byt 4', '190 00', 'Praha 9'),
      price: 0,
    },
    {
      id: 'cz-courier-karlovo',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Jana Nováková',
      phone: '+420 601 111 222',
      email: 'qa.auto.checkout+cz@example.com',
      city: 'Praha',
      addressLine: 'Karlovo náměstí 10, 120 00 Praha 2',
      address: fields('Karlovo náměstí 10', 'byt 6', '120 00', 'Praha 2'),
      price: 0,
    },
  ],

  us: [
    {
      id: 'us-courier-fifth-avenue',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      badgeKey: 'address.badge.last',
      recipientName: 'John Miller',
      phone: '+1 212 111 2233',
      email: 'qa.auto.checkout+us@example.com',
      city: 'New York',
      addressLine: '350 5th Ave, New York, NY 10118',
      address: fields('350 5th Ave', 'Apt 21B', '10118', 'New York', { region: 'NY' }),
      price: 0,
    },
    {
      id: 'us-courier-astor-place',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'Sarah Johnson',
      phone: '+1 212 222 3344',
      email: 'qa.auto.checkout+us@example.com',
      city: 'New York',
      addressLine: '1 Astor Pl, New York, NY 10003',
      address: fields('1 Astor Pl', 'Apt 5C', '10003', 'New York', { region: 'NY' }),
      price: 0,
    },
    {
      id: 'us-courier-west-57th',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'David Brown',
      phone: '+1 212 333 4455',
      email: 'qa.auto.checkout+us@example.com',
      city: 'New York',
      addressLine: '200 W 57th St, New York, NY 10019',
      address: fields('200 W 57th St', 'Apt 12A', '10019', 'New York', { region: 'NY' }),
      price: 0,
    },
    {
      id: 'us-courier-west-34th',
      method: 'courier',
      methodKey: 'delivery.method.courier',
      recipientName: 'John Miller',
      phone: '+1 212 111 2233',
      email: 'qa.auto.checkout+us@example.com',
      city: 'New York',
      addressLine: '15 W 34th St, New York, NY 10001',
      address: fields('15 W 34th St', 'Apt 8D', '10001', 'New York', { region: 'NY' }),
      price: 0,
    },
  ],
}
