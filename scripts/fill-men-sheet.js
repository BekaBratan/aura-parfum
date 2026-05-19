const XLSX = require("xlsx");

const FILE = "excels/AZ-ZAHRA(Парфюм).xlsx";
const SHEET = "Мужские";
const HEADER_ROW = 3;
const COL = { BRAND: 4, DESC: 5, STOCK: 6, COUNTRY: 7, IMAGE: 8 };

const FR = "Франция";
const LZ = "Швейцария";
const SL = "Турция";
const IMG = (f) => f ? `images/men/${f}` : "";

// [rowIndex, brand, description, stock, country, imagePath]
const ROWS = [
  [4,  "Carolina Herrera",   "Игристый фужерный аромат с нотами цитруса, кардамона и белого кедра. Современный и обаятельный — для уверенного мужчины.",                                      500, FR, IMG("212 SEXY.jpeg")],
  [5,  "Amouage",            "Пряный восточный аромат с нотами ладана, кожи и смолы. Мощный и аристократичный — оманская роскошь для настоящих ценителей.",                                    500, FR, IMG("Amouage Interlude.jpeg")],
  [6,  "Antonio Banderas",   "Свежий акватический аромат с нотами морского бриза, цитруса и кедра. Лёгкий и харизматичный — для активного современного мужчины.",                               500, "", IMG("Antonio banderas blue seduction.png")],
  [7,  "Giorgio Armani",     "Свежий аква-флоральный аромат с нотами нероли, персиконового дерева и белого мускуса. Культовый аромат моря и свободы от Armani.",                               500, FR, IMG("ARMANI ACQUA DI GIO FR 1.png")],
  [8,  "Giorgio Armani",     "Свежий аква-флоральный аромат с нотами нероли, персиконового дерева и белого мускуса. Культовый аромат моря и свободы от Armani.",                               500, FR, IMG("ARMANI ACQUA DI GIO FR 2.png")],
  [9,  "Giorgio Armani",     "Свежий аква-флоральный аромат с нотами нероли, персиконового дерева и белого мускуса. Культовый аромат моря и свободы от Armani.",                               500, LZ, IMG("ARMANI ACQUA DI GIO LZ.jpeg")],
  [10, "Giorgio Armani",     "Свежий дымный аромат с нотами кардамона, кедра и сандала. Armani Code Sport — спортивный темперамент итальянской элегантности.",                                 500, FR, IMG("ARMANI CODE SPORT Black FR.png")],
  [11, "Giorgio Armani",     "Сладкий цветочно-древесный аромат с нотами ванили, кардамона и кашмира. Тёплый и чувственный — для мужчины, который не боится быть нежным.",                    500, FR, IMG("ARMANI STRONGER WITH YOU FR.jpeg")],
  [12, "Giorgio Armani",     "Сладкий цветочно-древесный аромат с нотами ванили, кардамона и кашмира. Тёплый и чувственный — для мужчины, который не боится быть нежным.",                    500, FR, IMG("ARMANI STRONGER WITH YOU FR.jpeg")],
  [13, "Giorgio Armani",     "Сладкий цветочно-древесный аромат с нотами ванили, кардамона и кашмира. Тёплый и чувственный — для мужчины, который не боится быть нежным.",                    500, LZ, IMG("ARMANI STRONGER WITH YOU LZ.png")],
  [14, "Giorgio Armani",     "Интенсивная версия Stronger With You с нотами шалфея, кашемира и ванили. Более тёмная и настойчивая интерпретация абсолютной силы.",                            500, FR, IMG("ARMANI STRONGER WITH YOU ABSOLUTELY FR.jpeg")],
  [15, "Giorgio Armani",     "Интенсивная версия Stronger With You с нотами шалфея, кашемира и ванили. Более тёмная и настойчивая интерпретация абсолютной силы.",                            500, FR, IMG("ARMANI STRONGER WITH YOU ABSOLUTELY FR.jpeg")],
  [16, "Bulgari",            "Свежий акватический аромат с нотами воды, кедра и белого мускуса. Bulgari в своей лучшей морской интерпретации.",                                                500, "", IMG("BVLGARI ATLANTIGVE AQVA POUR HOMME.jpeg")],
  [17, "Bulgari",            "Тёмный восточный аромат с нотами чёрного чая, тонки бобов и кожи. Bulgari Man in Black — мощный и таинственный, как сама ночь.",                               500, FR, IMG("BVLGARI MAN IN BLACK.jpeg")],
  [18, "Bulgari",            "Роскошный восточный аромат с нотами уда, сандала и кожи. Bulgari Le Gemme — ювелирная коллекция ароматов для настоящих ценителей.",                             500, FR, IMG("BVLGARI LE GEMME AZARAN FR.jpeg")],
  [19, "Bulgari",            "Экзотический древесный аромат с нотами тигрового ореха, ветивера и мускуса. Bulgari Le Gemme Tygar — дикая природа в изысканном флаконе.",                      500, SL, IMG("BVLGARI LE GEMME TYGAR SL.jpeg")],
  [20, "Bulgari",            "Экзотический древесный аромат с нотами тигрового ореха, ветивера и мускуса. Bulgari Le Gemme Tygar — дикая природа в изысканном флаконе.",                      500, LZ, IMG("BVLGARI LE GEMME TYGAR LZ.jpg")],
  [21, "Bulgari",            "Небесный цветочно-мускусный аромат с нотами цитруса, ладана и амбры. Bulgari Le Gemme Empyr — вдохновлён легендой о небесном огне.",                            500, FR, IMG("BVLGARI LE GEMME EMPYR FR.jpeg")],
  [22, "Creed",              "Легендарный фруктово-берёзовый аромат с нотами ананаса, бергамота и мускуса. Aventus — культовый парфюм для лидеров и победителей.",                           500, LZ, IMG("CREED AVENTUS LZ.jpeg")],
  [23, "Creed",              "Легендарный фруктово-берёзовый аромат с нотами ананаса, бергамота и мускуса. Aventus — культовый парфюм для лидеров и победителей.",                           500, LZ, IMG("CREED AVENTUS LZ.jpeg")],
  [24, "Creed",              "Тёмная версия Aventus с нотами копчёной берёзы, уда и пачули. Aventus Absolu — для тех, кто хочет ещё больше характера и глубины.",                            500, LZ, IMG("CREED AVENTUS ABSOLU LZ.jpeg")],
  [25, "Creed",              "Тёмная версия Aventus с нотами копчёной берёзы, уда и пачули. Aventus Absolu — для тех, кто хочет ещё больше характера и глубины.",                            500, LZ, IMG("CREED AVENTUS ABSOLU LZ.jpeg")],
  [26, "Carolina Herrera",   "Элегантный фужерный аромат с нотами кориандра, кедра и белого мускуса. Chic for Men — утончённость и харизма в одном флаконе.",                                500, FR, IMG("CAROLINA HERRERA CHIC FOR MEN FR.jpeg")],
  [27, "Carolina Herrera",   "Игристый мужской аромат с нотами мускуса, кедра и цитруса. 212 VIP Men — для тех, кто всегда в центре праздника.",                                             500, LZ, IMG("CAROLINA HERRERA 212 VIP MEN LZ.jpeg")],
  [28, "Carolina Herrera",   "Игристый мужской аромат с нотами мускуса, кедра и цитруса. 212 VIP Men — для тех, кто всегда в центре праздника.",                                             500, "", IMG("CAROLINA HERRERA 212 VIP MEN LZ.jpeg")],
  [29, "Chanel",             "Классический мужской аромат с нотами цитруса, лаванды и кедра. Egoiste Platinum — сдержанное совершенство французского шика.",                                 500, LZ, IMG("CHANEL EGOISTE PLATINUM LZ.jpeg")],
  [30, "Chanel",             "Классический мужской аромат с нотами цитруса, лаванды и кедра. Egoiste Platinum — сдержанное совершенство французского шика.",                                 500, FR, IMG("CHANEL EGOISTE PLATINUM LZ.jpeg")],
  [31, "Chanel",             "Свежий древесный аромат с нотами лимона, кедра и белого мускуса. Bleu de Chanel — воплощение мужской свободы и независимости.",                                500, FR, IMG("CHANEL BLEU DE FR.jpeg")],
  [32, "Chanel",             "Свежий древесный аромат с нотами лимона, кедра и белого мускуса. Bleu de Chanel — воплощение мужской свободы и независимости.",                                500, FR, IMG("CHANEL BLEU DE FR.jpeg")],
  [33, "Chanel",             "Свежий древесный аромат с нотами лимона, кедра и белого мускуса. Bleu de Chanel — воплощение мужской свободы и независимости.",                                500, LZ, IMG("CHANEL BLEU DE FR.jpeg")],
  [34, "Chanel",             "Свежий спортивный аромат с нотами мандарина, белого мускуса и кедра. Allure Homme Sport — динамика и элегантность Chanel для активных мужчин.",                500, FR, IMG("CHANEL ALLURE HOMME SPORT FR.jpeg")],
  [35, "Chanel",             "Свежий спортивный аромат с нотами мандарина, белого мускуса и кедра. Allure Homme Sport — динамика и элегантность Chanel для активных мужчин.",                500, FR, IMG("CHANEL ALLURE HOMME SPORT FR.jpeg")],
  [36, "Chanel",             "Свежий спортивный аромат с нотами мандарина, белого мускуса и кедра. Allure Homme Sport — динамика и элегантность Chanel для активных мужчин.",                500, LZ, IMG("CHANEL ALLURE HOMME SPORT FR.jpeg")],
  [37, "Dolce & Gabbana",    "Свежий средиземноморский аромат с нотами грейпфрута, розмарина и мускуса. Light Blue Men — воплощение итальянского лета у моря.",                              500, "", IMG("DOLCE&GABBANA LIGHT BLUE POUR HOMME.jpeg")],
  [38, "Davidoff",           "Свежий аква-цветочный аромат с нотами мяты, базилика и белого мускуса. Cool Water — классика 90-х, актуальная по сей день.",                                   500, FR, IMG("DAVIDOFF COOL WATER MEN FR.jpeg")],
  [39, "Dior",               "Интенсивный мужской аромат с нотами ириса, лаванды и пачули. Dior Homme Intense — мощная и элегантная версия классического Homme.",                           500, FR, IMG("DIOR HOMME INTENSE FR.jpeg")],
  [40, "Dior",               "Свежий спортивный аромат с нотами цитруса, кардамона и белого мускуса. Dior Homme Sport — лёгкость и динамика современного мужчины.",                         500, FR, IMG("DIOR HOMME SPORT FR.jpeg")],
  [41, "Dior",               "Пряный деревесный аромат с нотами перца, лаванды и амбры. Sauvage — один из самых продаваемых мужских ароматов в мире.",                                       500, LZ, IMG("DIOR SAUVAGE LZ.jpeg")],
  [42, "Dior",               "Пряный деревесный аромат с нотами перца, лаванды и амбры. Sauvage — один из самых продаваемых мужских ароматов в мире.",                                       500, LZ, IMG("DIOR SAUVAGE LZ.jpeg")],
  [43, "Dior",               "Пряный деревесный аромат с нотами перца, лаванды и амбры. Sauvage — один из самых продаваемых мужских ароматов в мире.",                                       500, FR, IMG("DIOR SAUVAGE LZ.jpeg")],
  [44, "Amouage",            "Мощный восточный аромат с нотами ладана, мирры и уда. Epic Man — одическая поэма о мужественности и силе духа от Amouage.",                                    500, FR, IMG("EPIC MEN AMOUAGE FR.jpeg")],
  [45, "Givenchy",           "Свежий фужерный аромат с нотами мяты, базилика и кедра. Pour Homme Blue Label — классический мужской парфюм от Givenchy.",                                    500, FR, IMG("GIVENCHY POUR HOMME BLUE LABEL FR.jpeg")],
  [46, "Givenchy",           "Изысканный цветочно-пряный аромат с нотами пиона, перца и пачули. Gentleman Givenchy — современный взгляд на классическую мужественность.",                   500, FR, IMG("GIVENCHY GENTLEMAN FR.jpeg")],
  [47, "Hugo Boss",          "Свежий яблочно-цветочный аромат с нотами яблока, корицы и сандала. Boss Bottled — тридцать лет в качестве символа мужской уверенности.",                      500, FR, IMG("HUGO BOSS BOTTLED FR.jpeg")],
  [48, "Jean Paul Gaultier", "Пряный пудровый аромат с нотами лаванды, ванили и тонки бобов. Scandal Pour Homme — мужской антипод культового женского Scandal.",                            500, FR, IMG("JEAN PAUL GAULTIER SCANDAL POUR HOMME FR.jpeg")],
  [49, "Jean Paul Gaultier", "Свежий морской аромат с нотами кокоса, флердоранжа и мускуса. Le Beau — тропическая свобода в стиле JPG.",                                                    500, FR, IMG("JEAN PAUL GAULTIER LE BEAU FR.jpeg")],
  [50, "Jean Paul Gaultier", "Культовый восточный аромат с нотами лаванды, мяты и ванили. Le Male — один из самых знаковых мужских ароматов всех времён.",                                  500, FR, IMG("JEAN PAUL GAULTIER LE MALE FR.jpeg")],
  [51, "Jimmy Choo",         "Свежий пряный аромат с нотами кардамона, мёда и пачули. Jimmy Choo Man — стильный и уверенный, как сам модный дом.",                                           500, "", IMG("JIMMY CHOO MAN.jpeg")],
  [52, "Kenzo",              "Свежий водянистый аромат с нотами лотоса, белого мускуса и кедра. L'Eau Kenzo Pour Homme — лёгкость природы в японском стиле.",                               500, FR, IMG("KENZO L'EAU PAR POUR HOMME FR.jpeg")],
  [53, "Louis Vuitton",      "Восточно-древесный аромат с нотами уда, розы и шафрана. Ombre Nomade — нишевый шедевр Louis Vuitton о странствиях и тайне.",                                   500, SL, IMG("LOUIS VUITTON OMBRE NOMADE SL.jpeg")],
  [54, "Louis Vuitton",      "Восточно-древесный аромат с нотами уда, розы и шафрана. Ombre Nomade — нишевый шедевр Louis Vuitton о странствиях и тайне.",                                   500, LZ, IMG("LOUIS VUITTON OMBRE NOMADE SL.jpeg")],
  [55, "Louis Vuitton",      "Свежий цитрусовый аромат с нотами грейпфрута, белого мускуса и кедра. Météore — нишевый аромат Louis Vuitton о метеоритном блеске.",                           500, FR, IMG("LOUIS VUITTON METEORE FR.jpeg")],
  [56, "Louis Vuitton",      "Свежий цитрусовый аромат с нотами грейпфрута, белого мускуса и кедра. Météore — нишевый аромат Louis Vuitton о метеоритном блеске.",                           500, "", IMG("LOUIS VUITTON METEORE FR.jpeg")],
  [57, "Louis Vuitton",      "Фужерный аромат с нотами пальмового дерева, голубого кедра и амбры. L'Immensite — океанское безбрежие в нишевом флаконе Louis Vuitton.",                      500, LZ, IMG("LOUIS VUITTON L'IMMENSITE LZ.jpeg")],
  [58, "Louis Vuitton",      "Фужерный аромат с нотами пальмового дерева, голубого кедра и амбры. L'Immensite — океанское безбрежие в нишевом флаконе Louis Vuitton.",                      500, FR, IMG("LOUIS VUITTON L'IMMENSITE LZ.jpeg")],
  [59, "Louis Vuitton",      "Свежий цветочный аромат с нотами бергамота, ириса и кедра. Imagination — мечта о далёких странах в каждой капле Louis Vuitton.",                              500, LZ, IMG("LOUIS VUITTON IMAGINATION LZ.jpeg")],
  [60, "Louis Vuitton",      "Свежий цветочный аромат с нотами бергамота, ириса и кедра. Imagination — мечта о далёких странах в каждой капле Louis Vuitton.",                              500, FR, IMG("LOUIS VUITTON IMAGINATION LZ.jpeg")],
  [61, "Lacoste",            "Зелёный свежий аромат с нотами грейпфрута, базилика и кедра. Essential — квинтэссенция стиля Lacoste в лаконичном флаконе.",                                  500, FR, IMG("LACOSTE ESSENTIAL FR.jpeg")],
  [62, "Lacoste",            "Чистый белый аромат с нотами цитруса, белого мускуса и сандала. Lacoste White — минимализм и свежесть французского стиля.",                                   500, FR, IMG("LACOSTE WHITE FR.jpeg")],
  [63, "Lacoste",            "Чистый белый аромат с нотами цитруса, белого мускуса и сандала. Lacoste White — минимализм и свежесть французского стиля.",                                   500, LZ, IMG("LACOSTE WHITE FR.jpeg")],
  [64, "Lacoste",            "Чистый белый аромат с нотами цитруса, белого мускуса и сандала. Lacoste White — минимализм и свежесть французского стиля.",                                   500, LZ, IMG("LACOSTE WHITE FR.jpeg")],
  [65, "Lacoste",            "Пряный красный аромат с нотами розового перца, кедра и белого мускуса. Red Rouge — яркий и дерзкий мужской аромат Lacoste.",                                  500, FR, IMG("LACOSTE RED ROUGE FR.jpeg")],
  [66, "Montblanc",          "Свежий древесный аромат с нотами бергамота, ветивера и пачули. Explorer — аромат для исследователей новых горизонтов от Montblanc.",                           500, FR, IMG("MONTBLANC EXPLORER FR.jpeg")],
  [67, "Montblanc",          "Свежий древесный аромат с нотами бергамота, ветивера и пачули. Explorer — аромат для исследователей новых горизонтов от Montblanc.",                           500, LZ, IMG("MONTBLANC EXPLORER FR.jpeg")],
  [68, "Paco Rabanne",       "Тёмный пряный аромат с нотами аниса, кедра и чёрной кожи. Black XS — провокация и сексуальность в каждой ноте Paco Rabanne.",                                500, LZ, IMG("PACO RABANNE BLACK XS LZ.jpeg")],
  [69, "Paco Rabanne",       "Гламурный сладкий аромат с нотами мяты, корицы и пачули. One Million — парфюм для победителей в культовом золотом флаконе.",                                   500, FR, IMG("PACO RABANNE ONE MILLION FR.jpeg")],
  [70, "Paco Rabanne",       "Гламурный сладкий аромат с нотами мяты, корицы и пачули. One Million — парфюм для победителей в культовом золотом флаконе.",                                   500, FR, IMG("PACO RABANNE ONE MILLION FR.jpeg")],
  [71, "Paco Rabanne",       "Гламурный сладкий аромат с нотами мяты, корицы и пачули. One Million — парфюм для победителей в культовом золотом флаконе.",                                   500, LZ, IMG("PACO RABANNE ONE MILLION FR.jpeg")],
  [72, "Paco Rabanne",       "Свежий морской аромат с нотами грейпфрута, лавра и амбры. Invictus — мощь и победа в спортивном флаконе-трофее.",                                             500, FR, IMG("INVICTUS PACO RABANNE FR.jpeg")],
  [73, "Paco Rabanne",       "Свежий морской аромат с нотами грейпфрута, лавра и амбры. Invictus — мощь и победа в спортивном флаконе-трофее.",                                             500, FR, IMG("INVICTUS PACO RABANNE FR.jpeg")],
  [74, "Roja Dove",          "Роскошный цветочно-мускусный аромат с нотами цитруса, белого мускуса и амбры. Elysium — рай в флаконе от легендарного парфюмера Roja Dove.",                   500, FR, IMG("ROJA DOVE ELYSIUM POUR HOMME FR.jpeg")],
  [75, "Roja Dove",          "Cologne-версия Elysium с нотами грейпфрута, лаванды и белого мускуса. Более лёгкая, но такая же совершенная интерпретация элизиума.",                         500, LZ, IMG("ROJA DOVE ELYSIUM POUR HOMME FR.jpeg")],
  [76, "Roja Dove",          "Роскошный цветочно-мускусный аромат с нотами цитруса, белого мускуса и амбры. Elysium — рай в флаконе от легендарного парфюмера Roja Dove.",                   500, FR, IMG("ROJA DOVE ELYSIUM POUR HOMME FR.jpeg")],
  [77, "Shaik",              "Восточный аромат с нотами уда, розы и мускуса. Shaik 77 — арабская роскошь для мужчин с изысканным вкусом.",                                                  500, FR, IMG("SHAIK 77 FR.jpeg")],
  [78, "Versace",            "Свежий восточный аромат с нотами мяты, тонки бобов и амбры. Versace Eros — аромат страсти и силы, названный в честь греческого бога любви.",                  500, FR, IMG("VERSACE EROS FR.jpeg")],
  [79, "Versace",            "Свежий цитрусово-водный аромат с нотами лимона, нероли и белого мускуса. Man Fraiche — итальянская свежесть в каждом вздохе.",                                500, FR, IMG("VERSACE MAN FRAICHE FR.jpeg")],
  [80, "Versace",            "Свежий цитрусово-водный аромат с нотами лимона, нероли и белого мускуса. Man Fraiche — итальянская свежесть в каждом вздохе.",                                500, FR, IMG("VERSACE MAN FRAICHE FR.jpeg")],
  [81, "Versace",            "Элегантный мужской аромат с нотами нероли, цикламена и кедра. Pour Homme — квинтэссенция итальянского мужского шика от Versace.",                             500, FR, IMG("VERSACE POUR HOMME FR.jpeg")],
  [82, "Yves Saint Laurent", "Свежий фужерный аромат с нотами яблока, имбиря и кедра. YSL Y for Men — аромат нового поколения молодых и амбициозных.",                                      500, FR, IMG("YSL Y FOR MEN FR.jpeg")],
  [83, "Yves Saint Laurent", "Элегантный пряный аромат с нотами лимона, имбиря и ветивера. L'Homme — классический мужской парфюм от Yves Saint Laurent.",                                   500, "", IMG("YSL L'HOMME.jpeg")],
  [84, "Yves Saint Laurent", "Свежий цитрусово-металлический аромат с нотами кардамона, амброксана и кедра. Myself — аромат для тех, кто определяет себя сам.",                             500, FR, IMG("YSL MYSLF FR.jpeg")],
];

const wb = XLSX.readFile(FILE);
const ws = wb.Sheets[SHEET];

const NEW_COLS = ["Бренд", "Описание", "Запас (мл)", "Страна происхождения", "Рисунок (URL)"];
NEW_COLS.forEach((col, i) => {
  const addr = XLSX.utils.encode_cell({ r: HEADER_ROW, c: 4 + i });
  if (!ws[addr] || !ws[addr].v) ws[addr] = { v: col, t: "s" };
});

let filled = 0;
for (const [rowIdx, brand, desc, stock, country, image] of ROWS) {
  const set = (col, val) => {
    ws[XLSX.utils.encode_cell({ r: rowIdx, c: col })] = { v: val, t: typeof val === "number" ? "n" : "s" };
  };
  set(COL.BRAND,   brand);
  set(COL.DESC,    desc);
  set(COL.STOCK,   stock);
  set(COL.COUNTRY, country);
  set(COL.IMAGE,   image);
  filled++;
}

const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
range.e.c = Math.max(range.e.c, 8);
ws["!ref"] = XLSX.utils.encode_range(range);

XLSX.writeFile(wb, FILE);
console.log(`✓ Заполнено ${filled} строк в листе "${SHEET}"`);
