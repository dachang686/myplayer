var ROOKIE_NAMES = [
  { id: "N001", cn: "布姆杰" },
  { id: "N002", cn: "库斯图里卡" },
  { id: "N003", cn: "斯皮尔斯" },
  { id: "N004", cn: "罗瑟" },
  { id: "N005", cn: "布莱克" },
  { id: "N006", cn: "迪格斯" },
  { id: "N007", cn: "索利曼" },
  { id: "N008", cn: "奥萨鲁伊" },
  { id: "N009", cn: "埃克济" },
  { id: "N010", cn: "乌沃" },
  { id: "N011", cn: "亨利" },
  { id: "N012", cn: "扬加拉" },
  { id: "N013", cn: "克劳" },
  { id: "N014", cn: "佩奇" },
  { id: "N015", cn: "瓦克斯" },
  { id: "N016", cn: "凯泽" },
  { id: "N017", cn: "安德森" },
  { id: "N018", cn: "保罗" },
  { id: "N019", cn: "加斯金斯" },
  { id: "N020", cn: "乔丹" },
  { id: "N021", cn: "汉普顿" },
  { id: "N022", cn: "阿莫索夫" },
  { id: "N023", cn: "吉布森" },
  { id: "N024", cn: "阿里扎" },
  { id: "N025", cn: "克努佩尔" },
  { id: "N026", cn: "古斯比" },
  { id: "N027", cn: "内史密斯" },
  { id: "N028", cn: "里皮" },
  { id: "N029", cn: "图雷" },
  { id: "N030", cn: "霍华德" },
  { id: "N031", cn: "别利察" },
  { id: "N032", cn: "科斯比" },
  { id: "N033", cn: "亚当斯" },
  { id: "N034", cn: "兰德鲁" },
  { id: "N035", cn: "威尔金斯" },
  { id: "N036", cn: "布莱恩特" },
  { id: "N037", cn: "福格尔" },
  { id: "N038", cn: "巴斯克斯" },
  { id: "N039", cn: "伦纳德" },
  { id: "N040", cn: "拉特利夫" },
  { id: "N041", cn: "史密斯" },
  { id: "N042", cn: "约翰逊" },
  { id: "N043", cn: "西比" },
  { id: "N044", cn: "英格拉姆" },
  { id: "N045", cn: "奥科科" },
  { id: "N046", cn: "迪奥普" },
  { id: "N047", cn: "胡安" },
  { id: "N048", cn: "约翰逊" },
  { id: "N049", cn: "沃宾顿" },
  { id: "N050", cn: "康斯坦萨" },
  { id: "N051", cn: "贾米森" },
  { id: "N052", cn: "琼斯" },
  { id: "N053", cn: "斯科特" },
  { id: "N054", cn: "法科拉特" },
  { id: "N055", cn: "泰勒" },
  { id: "N056", cn: "威廉姆斯" },
  { id: "N057", cn: "韦伯" },
  { id: "N058", cn: "罗萨里奥" },
  { id: "N059", cn: "约翰逊" },
  { id: "N060", cn: "拉特利夫" },
  { id: "N061", cn: "奥博耶" },
  { id: "N062", cn: "康蒂" },
  { id: "N063", cn: "麦卡蒂" },
  { id: "N064", cn: "埃勒比" },
  { id: "N065", cn: "格林" },
  { id: "N066", cn: "刘易斯" },
  { id: "N067", cn: "埃斯特雷拉" },
  { id: "N068", cn: "哈灵顿" },
  { id: "N069", cn: "乌米多赫" },
  { id: "N070", cn: "华盛顿" },
  { id: "N071", cn: "霍姆斯" },
  { id: "N072", cn: "潘奇" },
  { id: "N073", cn: "詹金斯" },
  { id: "N074", cn: "兰杜雷" },
  { id: "N075", cn: "巴恩斯" },
  { id: "N076", cn: "弗鲁" },
  { id: "N077", cn: "克朗布尔" },
  { id: "N078", cn: "芬奇斯" },
  { id: "N079", cn: "通卡" },
  { id: "N080", cn: "本达洛" },
  { id: "N081", cn: "迪亚涅" },
  { id: "N082", cn: "欧文" },
  { id: "N083", cn: "菲利普斯" },
  { id: "N084", cn: "格兰特" },
  { id: "N085", cn: "威尔金斯" },
  { id: "N086", cn: "庞德" },
  { id: "N087", cn: "约翰逊" },
  { id: "N088", cn: "斯塔顿" },
  { id: "N089", cn: "里德" },
  { id: "N090", cn: "艾伦" },
  { id: "N091", cn: "埃尔胡姆文塞" },
  { id: "N092", cn: "布塔耶瓦斯" },
  { id: "N093", cn: "阿尔蒙德" },
  { id: "N094", cn: "斯科特" },
  { id: "N095", cn: "萨顿" },
  { id: "N096", cn: "丘克武德贝卢" },
  { id: "N097", cn: "奥尼尔" },
  { id: "N098", cn: "沃德" },
  { id: "N099", cn: "米勒" },
  { id: "N100", cn: "格拉斯" },
  { id: "N101", cn: "博尔" },
  { id: "N102", cn: "塞缪尔斯" },
  { id: "N103", cn: "博阿滕" },
  { id: "N104", cn: "哈里斯" },
  { id: "N105", cn: "祖吉奇" },
  { id: "N106", cn: "穆罕默德" },
  { id: "N107", cn: "罗" },
  { id: "N108", cn: "诺维尔" },
  { id: "N109", cn: "迪亚基特" },
  { id: "N110", cn: "拉夫" },
  { id: "N111", cn: "鲁宾逊" },
  { id: "N112", cn: "恩维格韦" },
  { id: "N113", cn: "基尼奥内斯" },
  { id: "N114", cn: "图姆斯" },
  { id: "N115", cn: "弗菲" },
  { id: "N116", cn: "曼达基特" },
  { id: "N117", cn: "詹姆斯" },
  { id: "N118", cn: "哈莱福努阿" },
  { id: "N119", cn: "琼斯" },
  { id: "N120", cn: "卡尔德隆" },
  { id: "N121", cn: "霍华德" },
  { id: "N122", cn: "坎宁安" },
  { id: "N123", cn: "布朗" },
  { id: "N124", cn: "赫德" },
  { id: "N125", cn: "雷" },
  { id: "N126", cn: "马卢克" },
  { id: "N127", cn: "恩武利" },
  { id: "N128", cn: "威廉姆斯" },
  { id: "N129", cn: "蒙托纳蒂" },
  { id: "N130", cn: "滕" },
  { id: "N131", cn: "弗拉格" },
  { id: "N132", cn: "奥利奥古" },
  { id: "N133", cn: "埃利斯" },
  { id: "N134", cn: "帕斯莫尔" },
  { id: "N135", cn: "欣顿" },
  { id: "N136", cn: "莫斯利" },
  { id: "N137", cn: "科斯蒂奇" },
  { id: "N138", cn: "查特曼" },
  { id: "N139", cn: "阿塞莫塔" },
];

var DRAFT_CLASS_2027 = [
  { pick: 1, id: "D001", cn: "史密斯" },
  { pick: 2, id: "D002", cn: "斯托克斯" },
  { pick: 3, id: "D003", cn: "约克西莫维奇" },
  { pick: 4, id: "D004", cn: "布兰奇" },
  { pick: 5, id: "D005", cn: "霍尔特" },
  { pick: 6, id: "D006", cn: "穆林斯" },
  { pick: 7, id: "D007", cn: "霍" },
  { pick: 8, id: "D008", cn: "苏伊戈" },
  { pick: 9, id: "D009", cn: "穆库里" },
  { pick: 10, id: "D010", cn: "威廉姆斯" },
  { pick: 11, id: "D011", cn: "阿雷纳斯" },
  { pick: 12, id: "D012", cn: "克里瓦斯" },
  { pick: 13, id: "D013", cn: "凯塔" },
  { pick: 14, id: "D014", cn: "乌因多" },
  { pick: 15, id: "D015", cn: "图雷" },
  { pick: 16, id: "D016", cn: "科林斯" },
  { pick: 17, id: "D017", cn: "明戈" },
  { pick: 18, id: "D018", cn: "尼昂" },
  { pick: 19, id: "D019", cn: "艾伦" },
  { pick: 20, id: "D020", cn: "莫雷诺" },
  { pick: 21, id: "D021", cn: "奇涅卢" },
  { pick: 22, id: "D022", cn: "巴科" },
  { pick: 23, id: "D023", cn: "汤普森" },
  { pick: 24, id: "D024", cn: "耶苏富" },
  { pick: 25, id: "D025", cn: "萨尔" },
  { pick: 26, id: "D026", cn: "蒂亚姆" },
  { pick: 27, id: "D027", cn: "奥拉多顿" },
  { pick: 28, id: "D028", cn: "迪奥普" },
  { pick: 29, id: "D029", cn: "麦肯尼" },
  { pick: 30, id: "D030", cn: "亨德森" },
  { pick: 31, id: "D031", cn: "里特豪泽" },
  { pick: 32, id: "D032", cn: "姆比亚" },
  { pick: 33, id: "D033", cn: "科尔曼" },
  { pick: 34, id: "D034", cn: "莫姆契洛维奇" },
  { pick: 35, id: "D035", cn: "麦科伊" },
  { pick: 36, id: "D036", cn: "迪亚内" },
  { pick: 37, id: "D037", cn: "米尔科维奇" },
  { pick: 38, id: "D038", cn: "沃基耶塔蒂斯" },
  { pick: 39, id: "D039", cn: "阿夫达拉斯" },
  { pick: 40, id: "D040", cn: "哈尔琴科夫" },
  { pick: 41, id: "D041", cn: "康登" },
  { pick: 42, id: "D042", cn: "穆里宁" },
  { pick: 43, id: "D043", cn: "雅各布森" },
  { pick: 44, id: "D044", cn: "里士满" },
  { pick: 45, id: "D045", cn: "阿布尔" },
  { pick: 46, id: "D046", cn: "卡尔" },
  { pick: 47, id: "D047", cn: "布莱克威尔" },
  { pick: 48, id: "D048", cn: "阿塔姆纳" },
  { pick: 49, id: "D049", cn: "斯托亚科维奇" },
  { pick: 50, id: "D050", cn: "麦克尼尔" },
  { pick: 51, id: "D051", cn: "科菲" },
  { pick: 52, id: "D052", cn: "坦纳" },
  { pick: 53, id: "D053", cn: "哈里斯" },
  { pick: 54, id: "D054", cn: "比东加" },
  { pick: 55, id: "D055", cn: "布泽尔" },
  { pick: 56, id: "D056", cn: "马霍普" },
  { pick: 57, id: "D057", cn: "文班亚马" },
  { pick: 58, id: "D058", cn: "安德鲁斯" },
  { pick: 59, id: "D059", cn: "伊维西奇" },
  { pick: 60, id: "D060", cn: "恩贡巴" },
  { pick: 61, id: "D061", cn: "托平" },
  { pick: 62, id: "D062", cn: "威尔金斯" },
  { pick: 63, id: "D063", cn: "桑德福特" },
  { pick: 64, id: "D064", cn: "蒂勒" },
  { pick: 65, id: "D065", cn: "邦克" },
  { pick: 66, id: "D066", cn: "菲尔斯" },
  { pick: 67, id: "D067", cn: "鲁日奇" },
  { pick: 68, id: "D068", cn: "莫里略" },
  { pick: 69, id: "D069", cn: "格伦洛" },
  { pick: 70, id: "D070", cn: "丹尼尔斯" },
  { pick: 71, id: "D071", cn: "鲍尔" },
  { pick: 72, id: "D072", cn: "迈耶" },
  { pick: 73, id: "D073", cn: "钱德勒" },
  { pick: 74, id: "D074", cn: "杰克逊" },
  { pick: 75, id: "D075", cn: "德里德尔" },
  { pick: 76, id: "D076", cn: "赖贝" },
  { pick: 77, id: "D077", cn: "哈梅尼亚" },
  { pick: 78, id: "D078", cn: "圣叙佩里" },
  { pick: 79, id: "D079", cn: "哈拉尔森" },
  { pick: 80, id: "D080", cn: "金尼" },
  { pick: 81, id: "D081", cn: "卡钦斯" },
  { pick: 82, id: "D082", cn: "德马利" },
  { pick: 83, id: "D083", cn: "斯尔珍蒂奇" },
  { pick: 84, id: "D084", cn: "哈格蒂" },
  { pick: 85, id: "D085", cn: "莱唐" },
  { pick: 86, id: "D086", cn: "赫夫" },
  { pick: 87, id: "D087", cn: "温特" },
  { pick: 88, id: "D088", cn: "西里尔" },
  { pick: 89, id: "D089", cn: "卡多" },
  { pick: 90, id: "D090", cn: "安东尼" },
  { pick: 91, id: "D091", cn: "巴加约卡" },
  { pick: 92, id: "D092", cn: "法耶" },
  { pick: 93, id: "D093", cn: "赖特" },
  { pick: 94, id: "D094", cn: "哈威尔" },
  { pick: 95, id: "D095", cn: "怀特" },
  { pick: 96, id: "D096", cn: "杰米森" },
  { pick: 97, id: "D097", cn: "阿里斯托德" },
  { pick: 98, id: "D098", cn: "佩蒂福德" },
  { pick: 99, id: "D099", cn: "塔格勒" },
  { pick: 100, id: "D100", cn: "麦克安德鲁" },
];

var STAR_ROOKIES = [
  { id: "S001", ratingId: "D001", cn: "史密斯", pick: 1, ovr: 85 },
  { id: "S002", ratingId: "D002", cn: "斯托克斯", pick: 2, ovr: 85 },
  { id: "S003", ratingId: "D003", cn: "约克西莫维奇", pick: 3, ovr: 85 },
  { id: "S004", cn: "布姆杰", pick: 1, ovr: 85 },
  { id: "S005", cn: "库斯图里卡", pick: 2, ovr: 85 },
  { id: "S006", cn: "斯皮尔斯", pick: 3, ovr: 85 },
];

// 2026 届真实新秀逐人审核后的固定能力；未列入者继续使用原选秀顺位模板。
var DRAFT_CLASS_2026_RATINGS = {
  "D26-01": {
    pos: "SF", profile: "two_way_wing", ovr: 81,
    attributes: { threePT: 72, MID: 85, FIN: 85, DNK: 83, HAN: 83, PAS: 75, PDEF: 75, STL: 70, IDEF: 63, BLK: 59, REB: 71, ATH: 85, STR: 73, CLU: 79 }
  },
  "D26-02": {
    pos: "SG", profile: "perimeter_scorer", ovr: 80,
    attributes: { threePT: 80, MID: 87, FIN: 81, DNK: 75, HAN: 83, PAS: 70, PDEF: 75, STL: 72, IDEF: 45, BLK: 39, REB: 55, ATH: 81, STR: 69, CLU: 81 }
  },
  "D26-03": {
    pos: "PF", profile: "interior_forward", ovr: 81,
    attributes: { threePT: 75, MID: 77, FIN: 85, DNK: 69, HAN: 77, PAS: 75, PDEF: 71, STL: 70, IDEF: 75, BLK: 65, REB: 84, ATH: 68, STR: 81, CLU: 77 }
  },
  "D26-04": {
    pos: "PF", profile: "interior_forward", ovr: 83,
    attributes: { threePT: 64, MID: 72, FIN: 84, DNK: 86, HAN: 73, PAS: 70, PDEF: 78, STL: 73, IDEF: 78, BLK: 80, REB: 82, ATH: 85, STR: 68, CLU: 72 }
  },
  "D26-05": {
    pos: "SG", profile: "perimeter_scorer", ovr: 78,
    attributes: { threePT: 85, MID: 83, FIN: 77, DNK: 53, HAN: 83, PAS: 79, PDEF: 71, STL: 62, IDEF: 39, BLK: 31, REB: 57, ATH: 71, STR: 45, CLU: 79 }
  },
  "D26-06": {
    pos: "PG", profile: "playmaker", ovr: 79,
    attributes: { threePT: 77, MID: 81, FIN: 81, DNK: 69, HAN: 85, PAS: 81, PDEF: 65, STL: 65, IDEF: 35, BLK: 29, REB: 47, ATH: 81, STR: 49, CLU: 75 }
  },
  "D26-07": {
    pos: "PG", profile: "playmaker", ovr: 80,
    attributes: { threePT: 82, MID: 80, FIN: 81, DNK: 62, HAN: 84, PAS: 82, PDEF: 64, STL: 59, IDEF: 32, BLK: 25, REB: 42, ATH: 80, STR: 62, CLU: 82 }
  },
  "D26-08": {
    pos: "PG", profile: "playmaker", ovr: 81,
    attributes: { threePT: 80, MID: 77, FIN: 81, DNK: 73, HAN: 83, PAS: 81, PDEF: 79, STL: 66, IDEF: 35, BLK: 29, REB: 51, ATH: 83, STR: 61, CLU: 75 }
  },
  "D26-09": {
    pos: "PF", profile: "interior_forward", ovr: 83,
    attributes: { threePT: 67, MID: 62, FIN: 85, DNK: 83, HAN: 71, PAS: 59, PDEF: 75, STL: 67, IDEF: 77, BLK: 75, REB: 81, ATH: 77, STR: 83, CLU: 69 }
  },
  "D26-10": {
    pos: "SG", profile: "two_way_slasher", ovr: 79,
    attributes: { threePT: 82, MID: 81, FIN: 84, DNK: 77, HAN: 81, PAS: 69, PDEF: 77, STL: 72, IDEF: 45, BLK: 37, REB: 59, ATH: 81, STR: 73, CLU: 75 }
  },
  "D26-11": {
    pos: "PF", profile: "stretch_four", ovr: 79,
    attributes: { threePT: 75, MID: 69, FIN: 80, DNK: 75, HAN: 73, PAS: 71, PDEF: 81, STL: 72, IDEF: 75, BLK: 73, REB: 75, ATH: 75, STR: 75, CLU: 75 }
  },
  "D26-12": {
    pos: "C", profile: "rim_protector", ovr: 81,
    attributes: { threePT: 42, MID: 62, FIN: 83, DNK: 73, HAN: 77, PAS: 71, PDEF: 53, STL: 51, IDEF: 85, BLK: 89, REB: 77, ATH: 55, STR: 77, CLU: 71 }
  },
  "D26-13": {
    pos: "SF", profile: "point_forward", ovr: 78,
    attributes: { threePT: 71, MID: 77, FIN: 81, DNK: 77, HAN: 81, PAS: 77, PDEF: 73, STL: 68, IDEF: 65, BLK: 57, REB: 71, ATH: 81, STR: 57, CLU: 73 }
  },
  "D26-14": {
    pos: "PF", profile: "interior_forward", ovr: 81,
    attributes: { threePT: 66, MID: 70, FIN: 84, DNK: 76, HAN: 74, PAS: 66, PDEF: 64, STL: 64, IDEF: 76, BLK: 72, REB: 86, ATH: 68, STR: 80, CLU: 70 }
  },
  "D26-15": {
    pos: "SF", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 71, MID: 81, FIN: 85, DNK: 79, HAN: 79, PAS: 75, PDEF: 79, STL: 65, IDEF: 61, BLK: 51, REB: 71, ATH: 81, STR: 77, CLU: 75 }
  },
  "D26-16": {
    pos: "PG", profile: "scoring_guard", ovr: 76,
    attributes: { threePT: 80, MID: 84, FIN: 72, DNK: 41, HAN: 84, PAS: 82, PDEF: 64, STL: 58, IDEF: 32, BLK: 26, REB: 40, ATH: 70, STR: 44, CLU: 80 }
  },
  "D26-17": {
    pos: "PG", profile: "scoring_guard", ovr: 78,
    attributes: { threePT: 76, MID: 82, FIN: 84, DNK: 56, HAN: 82, PAS: 72, PDEF: 68, STL: 69, IDEF: 28, BLK: 25, REB: 44, ATH: 82, STR: 66, CLU: 80 }
  },
  "D26-18": {
    pos: "PG", profile: "playmaker", ovr: 77,
    attributes: { threePT: 77, MID: 75, FIN: 73, DNK: 40, HAN: 83, PAS: 85, PDEF: 69, STL: 70, IDEF: 27, BLK: 25, REB: 43, ATH: 77, STR: 49, CLU: 75 }
  },
  "D26-19": {
    pos: "SF", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 82, MID: 74, FIN: 80, DNK: 78, HAN: 74, PAS: 70, PDEF: 78, STL: 75, IDEF: 70, BLK: 64, REB: 76, ATH: 76, STR: 70, CLU: 72 }
  },
  "D26-20": {
    pos: "C", profile: "rim_protector", ovr: 83,
    attributes: { threePT: 44, MID: 57, FIN: 77, DNK: 81, HAN: 59, PAS: 55, PDEF: 69, STL: 63, IDEF: 81, BLK: 85, REB: 79, ATH: 77, STR: 81, CLU: 69 }
  },
  "D26-21": {
    pos: "SF", profile: "two_way_wing", ovr: 77,
    attributes: { threePT: 76, MID: 74, FIN: 80, DNK: 78, HAN: 70, PAS: 66, PDEF: 80, STL: 72, IDEF: 68, BLK: 70, REB: 74, ATH: 76, STR: 76, CLU: 70 }
  },
  "D26-22": {
    pos: "PG", profile: "playmaker", ovr: 77,
    attributes: { threePT: 77, MID: 79, FIN: 73, DNK: 52, HAN: 83, PAS: 81, PDEF: 69, STL: 60, IDEF: 31, BLK: 25, REB: 43, ATH: 77, STR: 45, CLU: 73 }
  },
  "D26-23": {
    pos: "PF", profile: "interior_forward", ovr: 82,
    attributes: { threePT: 69, MID: 71, FIN: 81, DNK: 75, HAN: 71, PAS: 75, PDEF: 77, STL: 71, IDEF: 77, BLK: 83, REB: 77, ATH: 71, STR: 81, CLU: 75 }
  },
  "D26-24": {
    pos: "SG", profile: "two_way_slasher", ovr: 77,
    attributes: { threePT: 79, MID: 81, FIN: 81, DNK: 77, HAN: 79, PAS: 73, PDEF: 77, STL: 64, IDEF: 39, BLK: 31, REB: 51, ATH: 79, STR: 55, CLU: 75 }
  },
  "D26-25": {
    pos: "PG", profile: "playmaker", ovr: 77,
    attributes: { threePT: 77, MID: 77, FIN: 69, DNK: 57, HAN: 81, PAS: 83, PDEF: 77, STL: 64, IDEF: 41, BLK: 33, REB: 51, ATH: 73, STR: 61, CLU: 73 }
  },
  "D26-26": {
    pos: "C", profile: "rim_protector", ovr: 83,
    attributes: { threePT: 42, MID: 55, FIN: 81, DNK: 79, HAN: 61, PAS: 65, PDEF: 71, STL: 61, IDEF: 81, BLK: 83, REB: 83, ATH: 71, STR: 83, CLU: 73 }
  },
  "D26-27": {
    pos: "C", profile: "skilled_big", ovr: 79,
    attributes: { threePT: 73, MID: 71, FIN: 75, DNK: 75, HAN: 63, PAS: 59, PDEF: 67, STL: 58, IDEF: 75, BLK: 75, REB: 79, ATH: 73, STR: 79, CLU: 71 }
  },
  "D26-28": {
    pos: "PF", profile: "interior_forward", ovr: 80,
    attributes: { threePT: 74, MID: 74, FIN: 78, DNK: 72, HAN: 72, PAS: 74, PDEF: 80, STL: 78, IDEF: 74, BLK: 66, REB: 78, ATH: 70, STR: 82, CLU: 74 }
  },
  "D26-29": {
    pos: "PF", profile: "stretch_four", ovr: 77,
    attributes: { threePT: 81, MID: 77, FIN: 75, DNK: 67, HAN: 71, PAS: 73, PDEF: 77, STL: 64, IDEF: 71, BLK: 59, REB: 75, ATH: 69, STR: 75, CLU: 77 }
  },
  "D26-30": {
    pos: "PF", profile: "interior_forward", ovr: 79,
    attributes: { threePT: 72, MID: 74, FIN: 80, DNK: 78, HAN: 68, PAS: 62, PDEF: 68, STL: 60, IDEF: 72, BLK: 66, REB: 78, ATH: 74, STR: 82, CLU: 70 }
  },
  "D26-31": {
    pos: "PG", profile: "scoring_guard", ovr: 78,
    attributes: { threePT: 82, MID: 84, FIN: 76, DNK: 46, HAN: 82, PAS: 78, PDEF: 68, STL: 66, IDEF: 30, BLK: 25, REB: 54, ATH: 72, STR: 78, CLU: 80 }
  },
  "D26-32": {
    pos: "SG", profile: "perimeter_scorer", ovr: 77,
    attributes: { threePT: 81, MID: 79, FIN: 81, DNK: 73, HAN: 77, PAS: 69, PDEF: 75, STL: 73, IDEF: 43, BLK: 35, REB: 65, ATH: 75, STR: 73, CLU: 77 }
  },
  "D26-33": {
    pos: "SG", profile: "perimeter_scorer", ovr: 71,
    attributes: { threePT: 81, MID: 79, FIN: 69, DNK: 62, HAN: 73, PAS: 65, PDEF: 67, STL: 59, IDEF: 39, BLK: 31, REB: 49, ATH: 71, STR: 51, CLU: 71 }
  },
  "D26-34": {
    pos: "SG", profile: "two_way_slasher", ovr: 76,
    attributes: { threePT: 76, MID: 78, FIN: 74, DNK: 72, HAN: 78, PAS: 72, PDEF: 78, STL: 73, IDEF: 34, BLK: 26, REB: 48, ATH: 82, STR: 58, CLU: 72 }
  },
  "D26-35": {
    pos: "PF", profile: "stretch_four", ovr: 78,
    attributes: { threePT: 78, MID: 74, FIN: 74, DNK: 80, HAN: 70, PAS: 72, PDEF: 68, STL: 59, IDEF: 74, BLK: 72, REB: 80, ATH: 78, STR: 66, CLU: 72 }
  },
  "D26-36": {
    pos: "PF", profile: "stretch_four", ovr: 82,
    attributes: { threePT: 76, MID: 76, FIN: 82, DNK: 80, HAN: 78, PAS: 80, PDEF: 78, STL: 64, IDEF: 78, BLK: 76, REB: 86, ATH: 80, STR: 56, CLU: 76 }
  },
  "D26-37": {
    pos: "SG", profile: "perimeter_scorer", ovr: 75,
    attributes: { threePT: 84, MID: 80, FIN: 76, DNK: 64, HAN: 76, PAS: 68, PDEF: 70, STL: 67, IDEF: 38, BLK: 30, REB: 62, ATH: 70, STR: 74, CLU: 78 }
  },
  "D26-38": {
    pos: "PG", profile: "playmaker", ovr: 78,
    attributes: { threePT: 77, MID: 75, FIN: 75, DNK: 35, HAN: 83, PAS: 89, PDEF: 73, STL: 72, IDEF: 25, BLK: 25, REB: 43, ATH: 69, STR: 51, CLU: 79 }
  },
  "D26-39": {
    pos: "PG", profile: "playmaker", ovr: 77,
    attributes: { threePT: 69, MID: 73, FIN: 79, DNK: 69, HAN: 79, PAS: 81, PDEF: 77, STL: 64, IDEF: 41, BLK: 31, REB: 51, ATH: 81, STR: 67, CLU: 71 }
  },
  "D26-40": {
    pos: "SF", profile: "point_forward", ovr: 79,
    attributes: { threePT: 67, MID: 69, FIN: 79, DNK: 85, HAN: 73, PAS: 75, PDEF: 81, STL: 73, IDEF: 77, BLK: 73, REB: 79, ATH: 85, STR: 63, CLU: 73 }
  },
  "D26-41": {
    pos: "SG", profile: "two_way_slasher", ovr: 78,
    attributes: { threePT: 74, MID: 80, FIN: 84, DNK: 78, HAN: 78, PAS: 70, PDEF: 78, STL: 74, IDEF: 42, BLK: 32, REB: 60, ATH: 80, STR: 80, CLU: 76 }
  },
  "D26-42": {
    pos: "PG", profile: "playmaker", ovr: 78,
    attributes: { threePT: 78, MID: 78, FIN: 78, DNK: 44, HAN: 82, PAS: 82, PDEF: 70, STL: 61, IDEF: 28, BLK: 25, REB: 50, ATH: 72, STR: 62, CLU: 76 }
  },
  "D26-43": {
    pos: "PF", profile: "stretch_four", ovr: 74,
    attributes: { threePT: 66, MID: 74, FIN: 74, DNK: 66, HAN: 72, PAS: 76, PDEF: 66, STL: 58, IDEF: 70, BLK: 62, REB: 68, ATH: 66, STR: 68, CLU: 72 }
  },
  "D26-44": {
    pos: "PF", profile: "interior_forward", ovr: 80,
    attributes: { threePT: 61, MID: 67, FIN: 75, DNK: 71, HAN: 71, PAS: 77, PDEF: 77, STL: 63, IDEF: 81, BLK: 79, REB: 73, ATH: 75, STR: 71, CLU: 75 }
  },
  "D26-45": {
    pos: "SG", profile: "perimeter_scorer", ovr: 74,
    attributes: { threePT: 81, MID: 79, FIN: 73, DNK: 55, HAN: 77, PAS: 65, PDEF: 73, STL: 69, IDEF: 33, BLK: 25, REB: 47, ATH: 71, STR: 75, CLU: 81 }
  },
  "D26-46": {
    pos: "C", profile: "skilled_big", ovr: 80,
    attributes: { threePT: 40, MID: 56, FIN: 80, DNK: 82, HAN: 64, PAS: 70, PDEF: 66, STL: 58, IDEF: 78, BLK: 82, REB: 76, ATH: 74, STR: 76, CLU: 72 }
  },
  "D26-47": {
    pos: "SF", profile: "two_way_wing", ovr: 72,
    attributes: { threePT: 71, MID: 75, FIN: 75, DNK: 69, HAN: 69, PAS: 61, PDEF: 81, STL: 65, IDEF: 63, BLK: 51, REB: 57, ATH: 71, STR: 77, CLU: 71 }
  },
  "D26-48": {
    pos: "PF", profile: "interior_forward", ovr: 80,
    attributes: { threePT: 55, MID: 65, FIN: 83, DNK: 85, HAN: 69, PAS: 65, PDEF: 79, STL: 65, IDEF: 75, BLK: 73, REB: 83, ATH: 85, STR: 67, CLU: 71 }
  },
  "D26-49": {
    pos: "SF", profile: "two_way_wing", ovr: 75,
    attributes: { threePT: 79, MID: 77, FIN: 79, DNK: 69, HAN: 73, PAS: 69, PDEF: 71, STL: 67, IDEF: 59, BLK: 47, REB: 71, ATH: 69, STR: 77, CLU: 73 }
  },
  "D26-50": {
    pos: "PG", profile: "playmaker", ovr: 79,
    attributes: { threePT: 82, MID: 78, FIN: 74, DNK: 56, HAN: 80, PAS: 80, PDEF: 74, STL: 71, IDEF: 32, BLK: 25, REB: 52, ATH: 78, STR: 74, CLU: 76 }
  },
  "D26-51": {
    pos: "C", profile: "rim_protector", ovr: 83,
    attributes: { threePT: 32, MID: 53, FIN: 85, DNK: 81, HAN: 59, PAS: 57, PDEF: 75, STL: 72, IDEF: 81, BLK: 79, REB: 87, ATH: 73, STR: 75, CLU: 73 }
  },
  "D26-52": {
    pos: "C", profile: "skilled_big", ovr: 78,
    attributes: { threePT: 85, MID: 79, FIN: 87, DNK: 75, HAN: 67, PAS: 69, PDEF: 65, STL: 58, IDEF: 73, BLK: 71, REB: 81, ATH: 65, STR: 69, CLU: 73 }
  },
  "D26-53": {
    pos: "C", profile: "rim_protector", ovr: 82,
    attributes: { threePT: 56, MID: 58, FIN: 70, DNK: 76, HAN: 54, PAS: 48, PDEF: 74, STL: 62, IDEF: 84, BLK: 92, REB: 74, ATH: 82, STR: 70, CLU: 70 }
  },
  "D26-54": {
    pos: "SF", profile: "two_way_wing", ovr: 77,
    attributes: { threePT: 77, MID: 77, FIN: 79, DNK: 75, HAN: 73, PAS: 61, PDEF: 81, STL: 72, IDEF: 67, BLK: 65, REB: 71, ATH: 75, STR: 81, CLU: 71 }
  },
  "D26-55": {
    pos: "PF", profile: "stretch_four", ovr: 77,
    attributes: { threePT: 75, MID: 77, FIN: 79, DNK: 69, HAN: 73, PAS: 71, PDEF: 69, STL: 60, IDEF: 67, BLK: 59, REB: 75, ATH: 67, STR: 79, CLU: 73 }
  },
  "D26-56": {
    pos: "SF", profile: "two_way_wing", ovr: 78,
    attributes: { threePT: 87, MID: 81, FIN: 75, DNK: 65, HAN: 75, PAS: 71, PDEF: 79, STL: 72, IDEF: 63, BLK: 51, REB: 67, ATH: 71, STR: 75, CLU: 73 }
  },
  "D26-57": {
    pos: "C", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 54, MID: 60, FIN: 80, DNK: 78, HAN: 56, PAS: 62, PDEF: 64, STL: 58, IDEF: 84, BLK: 86, REB: 88, ATH: 66, STR: 84, CLU: 72 }
  },
  "D26-58": {
    pos: "SG", profile: "perimeter_scorer", ovr: 78,
    attributes: { threePT: 80, MID: 80, FIN: 78, DNK: 68, HAN: 78, PAS: 76, PDEF: 76, STL: 64, IDEF: 46, BLK: 34, REB: 62, ATH: 72, STR: 76, CLU: 78 }
  },
  "D26-59": {
    pos: "PF", profile: "interior_forward", ovr: 78,
    attributes: { threePT: 72, MID: 74, FIN: 82, DNK: 72, HAN: 68, PAS: 60, PDEF: 66, STL: 59, IDEF: 74, BLK: 66, REB: 80, ATH: 64, STR: 82, CLU: 74 }
  },
  "D26-60": {
    pos: "SF", profile: "two_way_wing", ovr: 75,
    attributes: { threePT: 79, MID: 75, FIN: 75, DNK: 73, HAN: 73, PAS: 71, PDEF: 77, STL: 70, IDEF: 59, BLK: 49, REB: 65, ATH: 81, STR: 53, CLU: 71 }
  }
};

// 2027 届及后续候选人逐人审核后的固定能力；未列入者继续使用原随机模板。
var FUTURE_PROSPECT_RATINGS = {
  "D001": {
    pos: "SG", height: "6'2\"", profile: "two_way_slasher", ovr: 83,
    attributes: { threePT: 79, MID: 83, FIN: 85, DNK: 77, HAN: 83, PAS: 79, PDEF: 83, STL: 86, IDEF: 39, BLK: 29, REB: 61, ATH: 83, STR: 77, CLU: 79 }
  },
  "D002": {
    pos: "SF", height: "6'8\"", profile: "point_forward", ovr: 83,
    attributes: { threePT: 70, MID: 76, FIN: 84, DNK: 82, HAN: 80, PAS: 80, PDEF: 80, STL: 86, IDEF: 74, BLK: 68, REB: 82, ATH: 82, STR: 80, CLU: 78 }
  },
  "D003": {
    pos: "SF", height: "6'7\"", profile: "point_forward", ovr: 80,
    attributes: { threePT: 80, MID: 84, FIN: 82, DNK: 72, HAN: 82, PAS: 78, PDEF: 74, STL: 71, IDEF: 62, BLK: 54, REB: 68, ATH: 76, STR: 64, CLU: 82 }
  },
  "D004": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 81,
    attributes: { threePT: 72, MID: 76, FIN: 80, DNK: 84, HAN: 78, PAS: 74, PDEF: 84, STL: 76, IDEF: 72, BLK: 72, REB: 82, ATH: 86, STR: 70, CLU: 74 }
  },
  "D005": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 79,
    attributes: { threePT: 76, MID: 78, FIN: 82, DNK: 84, HAN: 78, PAS: 72, PDEF: 82, STL: 74, IDEF: 44, BLK: 36, REB: 64, ATH: 86, STR: 76, CLU: 76 }
  },
  "D006": {
    pos: "SG", height: "6'6\"", profile: "perimeter_scorer", ovr: 74,
    attributes: { threePT: 79, MID: 77, FIN: 73, DNK: 69, HAN: 75, PAS: 65, PDEF: 73, STL: 68, IDEF: 39, BLK: 31, REB: 55, ATH: 77, STR: 59, CLU: 81 }
  },
  "D007": {
    pos: "PF", height: "6'9\"", profile: "stretch_four", ovr: 81,
    attributes: { threePT: 76, MID: 80, FIN: 82, DNK: 76, HAN: 76, PAS: 76, PDEF: 80, STL: 72, IDEF: 78, BLK: 74, REB: 78, ATH: 76, STR: 70, CLU: 82 }
  },
  "D008": {
    pos: "C", height: "7'1\"", profile: "rim_protector", ovr: 78,
    attributes: { threePT: 56, MID: 62, FIN: 74, DNK: 80, HAN: 56, PAS: 56, PDEF: 62, STL: 58, IDEF: 76, BLK: 78, REB: 78, ATH: 70, STR: 76, CLU: 68 }
  },
  "D009": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 82,
    attributes: { threePT: 75, MID: 79, FIN: 83, DNK: 83, HAN: 77, PAS: 67, PDEF: 81, STL: 74, IDEF: 75, BLK: 69, REB: 77, ATH: 85, STR: 79, CLU: 75 }
  },
  "D010": {
    pos: "C", height: "6'11\"", profile: "rim_protector", ovr: 79,
    attributes: { threePT: 64, MID: 68, FIN: 74, DNK: 82, HAN: 58, PAS: 60, PDEF: 68, STL: 64, IDEF: 80, BLK: 86, REB: 74, ATH: 80, STR: 66, CLU: 70 }
  },
  "D011": {
    pos: "SG", height: "6'6\"", profile: "two_way_slasher", ovr: 76,
    attributes: { threePT: 67, MID: 77, FIN: 79, DNK: 81, HAN: 79, PAS: 71, PDEF: 73, STL: 68, IDEF: 43, BLK: 37, REB: 59, ATH: 83, STR: 65, CLU: 75 }
  },
  "D012": {
    pos: "C", height: "7'2\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 54, MID: 66, FIN: 80, DNK: 78, HAN: 56, PAS: 64, PDEF: 64, STL: 61, IDEF: 84, BLK: 86, REB: 84, ATH: 70, STR: 82, CLU: 78 }
  },
  "D013": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 78,
    attributes: { threePT: 49, MID: 61, FIN: 77, DNK: 83, HAN: 55, PAS: 57, PDEF: 63, STL: 59, IDEF: 77, BLK: 77, REB: 75, ATH: 73, STR: 77, CLU: 65 }
  },
  "D014": {
    pos: "PF", height: "6'8\"", profile: "interior_forward", ovr: 84,
    attributes: { threePT: 59, MID: 67, FIN: 77, DNK: 83, HAN: 63, PAS: 59, PDEF: 73, STL: 65, IDEF: 81, BLK: 83, REB: 81, ATH: 79, STR: 79, CLU: 73 }
  },
  "D015": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 80,
    attributes: { threePT: 79, MID: 79, FIN: 83, DNK: 85, HAN: 77, PAS: 71, PDEF: 79, STL: 77, IDEF: 47, BLK: 57, REB: 67, ATH: 85, STR: 77, CLU: 79 }
  },
  "D016": {
    pos: "SF", height: "6'9\"", profile: "two_way_wing", ovr: 83,
    attributes: { threePT: 67, MID: 75, FIN: 81, DNK: 87, HAN: 73, PAS: 71, PDEF: 79, STL: 74, IDEF: 75, BLK: 71, REB: 83, ATH: 89, STR: 75, CLU: 77 }
  },
  "D017": {
    pos: "PG", height: "6'4\"", profile: "playmaker", ovr: 80,
    attributes: { threePT: 71, MID: 77, FIN: 81, DNK: 79, HAN: 83, PAS: 79, PDEF: 79, STL: 79, IDEF: 43, BLK: 33, REB: 73, ATH: 83, STR: 67, CLU: 77 }
  },
  "D018": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 80,
    attributes: { threePT: 66, MID: 74, FIN: 82, DNK: 88, HAN: 80, PAS: 78, PDEF: 84, STL: 76, IDEF: 48, BLK: 44, REB: 64, ATH: 90, STR: 72, CLU: 76 }
  },
  "D019": {
    pos: "SF", height: "6'8\"", profile: "point_forward", ovr: 78,
    attributes: { threePT: 74, MID: 76, FIN: 78, DNK: 74, HAN: 76, PAS: 78, PDEF: 74, STL: 70, IDEF: 68, BLK: 54, REB: 76, ATH: 74, STR: 66, CLU: 76 }
  },
  "D020": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 79,
    attributes: { threePT: 54, MID: 64, FIN: 76, DNK: 78, HAN: 56, PAS: 62, PDEF: 62, STL: 59, IDEF: 78, BLK: 80, REB: 78, ATH: 68, STR: 78, CLU: 80 }
  },
  "D021": {
    pos: "C", height: "6'10\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 41, MID: 57, FIN: 77, DNK: 79, HAN: 51, PAS: 49, PDEF: 65, STL: 63, IDEF: 87, BLK: 83, REB: 89, ATH: 73, STR: 87, CLU: 81 }
  },
  "D022": {
    pos: "C", height: "6'11\"", profile: "skilled_big", ovr: 80,
    attributes: { threePT: 65, MID: 73, FIN: 85, DNK: 81, HAN: 59, PAS: 55, PDEF: 63, STL: 59, IDEF: 77, BLK: 75, REB: 77, ATH: 73, STR: 79, CLU: 77 }
  },
  "D023": {
    pos: "SF", height: "6'9\"", profile: "two_way_wing", ovr: 84,
    attributes: { threePT: 77, MID: 83, FIN: 85, DNK: 81, HAN: 81, PAS: 73, PDEF: 79, STL: 72, IDEF: 79, BLK: 79, REB: 77, ATH: 81, STR: 75, CLU: 81 }
  },
  "D024": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 81,
    attributes: { threePT: 70, MID: 80, FIN: 84, DNK: 88, HAN: 78, PAS: 66, PDEF: 84, STL: 79, IDEF: 46, BLK: 50, REB: 74, ATH: 88, STR: 84, CLU: 82 }
  },
  "D025": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 82, MID: 78, FIN: 80, DNK: 78, HAN: 78, PAS: 68, PDEF: 82, STL: 75, IDEF: 64, BLK: 58, REB: 64, ATH: 84, STR: 64, CLU: 78 }
  },
  "D026": {
    pos: "C", height: "7'2\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 69, MID: 71, FIN: 79, DNK: 81, HAN: 57, PAS: 59, PDEF: 67, STL: 62, IDEF: 83, BLK: 91, REB: 79, ATH: 75, STR: 81, CLU: 77 }
  },
  "D027": {
    pos: "SF", height: "6'10\"", profile: "point_forward", ovr: 79,
    attributes: { threePT: 74, MID: 80, FIN: 82, DNK: 80, HAN: 78, PAS: 74, PDEF: 78, STL: 80, IDEF: 72, BLK: 66, REB: 74, ATH: 80, STR: 60, CLU: 78 }
  },
  "D028": {
    pos: "C", height: "7'1\"", profile: "skilled_big", ovr: 83,
    attributes: { threePT: 72, MID: 76, FIN: 84, DNK: 82, HAN: 62, PAS: 58, PDEF: 68, STL: 63, IDEF: 82, BLK: 88, REB: 76, ATH: 78, STR: 74, CLU: 78 }
  },
  "D029": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 76,
    attributes: { threePT: 80, MID: 78, FIN: 80, DNK: 72, HAN: 76, PAS: 64, PDEF: 74, STL: 69, IDEF: 42, BLK: 30, REB: 64, ATH: 74, STR: 80, CLU: 80 }
  },
  "D030": {
    pos: "SF", height: "6'6\"", profile: "two_way_wing", ovr: 82,
    attributes: { threePT: 70, MID: 78, FIN: 86, DNK: 84, HAN: 76, PAS: 70, PDEF: 78, STL: 72, IDEF: 72, BLK: 58, REB: 72, ATH: 82, STR: 88, CLU: 78 }
  },
  "D031": {
    pos: "SF", height: "6'8\"", profile: "point_forward", ovr: 78,
    attributes: { threePT: 77, MID: 79, FIN: 81, DNK: 77, HAN: 77, PAS: 73, PDEF: 73, STL: 68, IDEF: 67, BLK: 55, REB: 77, ATH: 75, STR: 65, CLU: 77 }
  },
  "D032": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 81,
    attributes: { threePT: 52, MID: 62, FIN: 74, DNK: 82, HAN: 52, PAS: 52, PDEF: 60, STL: 57, IDEF: 80, BLK: 86, REB: 80, ATH: 70, STR: 80, CLU: 70 }
  },
  "D033": {
    pos: "SG", height: "6'4\"", profile: "two_way_slasher", ovr: 79,
    attributes: { threePT: 82, MID: 82, FIN: 82, DNK: 72, HAN: 78, PAS: 74, PDEF: 80, STL: 82, IDEF: 40, BLK: 28, REB: 64, ATH: 78, STR: 60, CLU: 86 }
  },
  "D034": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 74,
    attributes: { threePT: 91, MID: 85, FIN: 75, DNK: 61, HAN: 71, PAS: 59, PDEF: 69, STL: 67, IDEF: 57, BLK: 45, REB: 61, ATH: 63, STR: 67, CLU: 85 }
  },
  "D035": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 80,
    attributes: { threePT: 76, MID: 80, FIN: 82, DNK: 84, HAN: 80, PAS: 74, PDEF: 82, STL: 81, IDEF: 44, BLK: 34, REB: 70, ATH: 86, STR: 72, CLU: 80 }
  },
  "D036": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 43, MID: 61, FIN: 83, DNK: 85, HAN: 49, PAS: 53, PDEF: 59, STL: 58, IDEF: 81, BLK: 81, REB: 85, ATH: 71, STR: 89, CLU: 73 }
  },
  "D037": {
    pos: "PF", height: "6'9\"", profile: "stretch_four", ovr: 83,
    attributes: { threePT: 75, MID: 79, FIN: 83, DNK: 77, HAN: 73, PAS: 75, PDEF: 75, STL: 70, IDEF: 79, BLK: 67, REB: 83, ATH: 71, STR: 85, CLU: 81 }
  },
  "D038": {
    pos: "C", height: "7'0\"", profile: "skilled_big", ovr: 80,
    attributes: { threePT: 44, MID: 64, FIN: 86, DNK: 80, HAN: 52, PAS: 52, PDEF: 58, STL: 57, IDEF: 76, BLK: 76, REB: 80, ATH: 66, STR: 84, CLU: 76 }
  },
  "D039": {
    pos: "SF", height: "6'9\"", profile: "point_forward", ovr: 79,
    attributes: { threePT: 75, MID: 79, FIN: 79, DNK: 69, HAN: 81, PAS: 83, PDEF: 73, STL: 70, IDEF: 57, BLK: 49, REB: 67, ATH: 73, STR: 67, CLU: 79 }
  },
  "D040": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 68, MID: 74, FIN: 80, DNK: 76, HAN: 78, PAS: 76, PDEF: 82, STL: 75, IDEF: 68, BLK: 58, REB: 76, ATH: 78, STR: 80, CLU: 78 }
  },
  "D041": {
    pos: "PF", height: "6'11\"", profile: "interior_forward", ovr: 84,
    attributes: { threePT: 58, MID: 72, FIN: 84, DNK: 80, HAN: 72, PAS: 78, PDEF: 76, STL: 71, IDEF: 82, BLK: 80, REB: 80, ATH: 72, STR: 82, CLU: 80 }
  },
  "D042": {
    pos: "PF", height: "7'0\"", profile: "stretch_four", ovr: 77,
    attributes: { threePT: 72, MID: 72, FIN: 76, DNK: 86, HAN: 74, PAS: 66, PDEF: 72, STL: 67, IDEF: 68, BLK: 66, REB: 68, ATH: 88, STR: 60, CLU: 72 }
  },
  "D043": {
    pos: "C", height: "7'4\"", profile: "rim_protector", ovr: 81,
    attributes: { threePT: 55, MID: 61, FIN: 83, DNK: 81, HAN: 55, PAS: 55, PDEF: 61, STL: 58, IDEF: 79, BLK: 89, REB: 75, ATH: 63, STR: 85, CLU: 73 }
  },
  "D044": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 80,
    attributes: { threePT: 54, MID: 64, FIN: 84, DNK: 88, HAN: 70, PAS: 64, PDEF: 80, STL: 74, IDEF: 66, BLK: 58, REB: 72, ATH: 90, STR: 80, CLU: 74 }
  },
  "D045": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 77,
    attributes: { threePT: 79, MID: 77, FIN: 79, DNK: 79, HAN: 75, PAS: 65, PDEF: 81, STL: 73, IDEF: 41, BLK: 31, REB: 63, ATH: 83, STR: 71, CLU: 75 }
  },
  "D046": {
    pos: "SF", height: "6'6\"", profile: "two_way_wing", ovr: 83,
    attributes: { threePT: 61, MID: 69, FIN: 83, DNK: 93, HAN: 67, PAS: 63, PDEF: 81, STL: 75, IDEF: 69, BLK: 59, REB: 75, ATH: 93, STR: 85, CLU: 75 }
  },
  "D047": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 80,
    attributes: { threePT: 85, MID: 83, FIN: 81, DNK: 71, HAN: 79, PAS: 71, PDEF: 77, STL: 72, IDEF: 37, BLK: 25, REB: 73, ATH: 79, STR: 77, CLU: 85 }
  },
  "D048": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 78,
    attributes: { threePT: 79, MID: 79, FIN: 75, DNK: 73, HAN: 79, PAS: 77, PDEF: 73, STL: 68, IDEF: 39, BLK: 29, REB: 55, ATH: 79, STR: 61, CLU: 75 }
  },
  "D049": {
    pos: "SF", height: "6'7\"", profile: "point_forward", ovr: 77,
    attributes: { threePT: 58, MID: 84, FIN: 86, DNK: 76, HAN: 78, PAS: 64, PDEF: 72, STL: 68, IDEF: 64, BLK: 50, REB: 74, ATH: 78, STR: 76, CLU: 82 }
  },
  "D050": {
    pos: "SG", height: "6'5\"", profile: "perimeter_scorer", ovr: 73,
    attributes: { threePT: 89, MID: 79, FIN: 73, DNK: 65, HAN: 71, PAS: 57, PDEF: 67, STL: 65, IDEF: 35, BLK: 27, REB: 61, ATH: 71, STR: 61, CLU: 79 }
  },
  "D051": {
    pos: "PF", height: "6'10\"", profile: "interior_forward", ovr: 84,
    attributes: { threePT: 69, MID: 71, FIN: 81, DNK: 79, HAN: 69, PAS: 69, PDEF: 75, STL: 69, IDEF: 83, BLK: 87, REB: 83, ATH: 75, STR: 79, CLU: 75 }
  },
  "D052": {
    pos: "PG", height: "6'0\"", profile: "playmaker", ovr: 82,
    attributes: { threePT: 76, MID: 80, FIN: 76, DNK: 62, HAN: 84, PAS: 86, PDEF: 86, STL: 85, IDEF: 32, BLK: 25, REB: 52, ATH: 84, STR: 60, CLU: 86 }
  },
  "D053": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 80,
    attributes: { threePT: 81, MID: 85, FIN: 85, DNK: 77, HAN: 79, PAS: 69, PDEF: 77, STL: 72, IDEF: 61, BLK: 51, REB: 81, ATH: 79, STR: 71, CLU: 85 }
  },
  "D054": {
    pos: "C", height: "6'10\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 35, MID: 51, FIN: 87, DNK: 87, HAN: 53, PAS: 61, PDEF: 71, STL: 67, IDEF: 85, BLK: 89, REB: 87, ATH: 87, STR: 83, CLU: 77 }
  },
  "D055": {
    pos: "PG", height: "6'4\"", profile: "playmaker", ovr: 80,
    attributes: { threePT: 69, MID: 75, FIN: 77, DNK: 73, HAN: 83, PAS: 87, PDEF: 79, STL: 76, IDEF: 37, BLK: 25, REB: 59, ATH: 81, STR: 73, CLU: 79 }
  },
  "D056": {
    pos: "SF", height: "6'5\"", profile: "point_forward", ovr: 77,
    attributes: { threePT: 65, MID: 71, FIN: 73, DNK: 75, HAN: 77, PAS: 81, PDEF: 77, STL: 72, IDEF: 65, BLK: 55, REB: 71, ATH: 81, STR: 69, CLU: 73 }
  },
  "D057": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 68, MID: 72, FIN: 76, DNK: 78, HAN: 76, PAS: 78, PDEF: 80, STL: 74, IDEF: 72, BLK: 68, REB: 78, ATH: 82, STR: 72, CLU: 76 }
  },
  "D058": {
    pos: "SF", height: "6'6\"", profile: "two_way_wing", ovr: 84,
    attributes: { threePT: 72, MID: 78, FIN: 86, DNK: 84, HAN: 76, PAS: 72, PDEF: 80, STL: 80, IDEF: 70, BLK: 62, REB: 88, ATH: 84, STR: 84, CLU: 82 }
  },
  "D059": {
    pos: "C", height: "7'1\"", profile: "skilled_big", ovr: 80,
    attributes: { threePT: 74, MID: 78, FIN: 80, DNK: 76, HAN: 64, PAS: 74, PDEF: 62, STL: 59, IDEF: 76, BLK: 72, REB: 80, ATH: 60, STR: 86, CLU: 76 }
  },
  "D060": {
    pos: "C", height: "6'11\"", profile: "skilled_big", ovr: 84,
    attributes: { threePT: 62, MID: 68, FIN: 84, DNK: 82, HAN: 60, PAS: 68, PDEF: 66, STL: 62, IDEF: 82, BLK: 80, REB: 82, ATH: 68, STR: 90, CLU: 76 }
  },
  "D061": {
    pos: "PF", height: "6'9\"", profile: "interior_forward", ovr: 86,
    attributes: { threePT: 58, MID: 74, FIN: 88, DNK: 84, HAN: 72, PAS: 68, PDEF: 78, STL: 74, IDEF: 84, BLK: 80, REB: 88, ATH: 82, STR: 86, CLU: 82 }
  },
  "D062": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 81,
    attributes: { threePT: 74, MID: 82, FIN: 84, DNK: 78, HAN: 84, PAS: 78, PDEF: 80, STL: 73, IDEF: 40, BLK: 28, REB: 68, ATH: 80, STR: 72, CLU: 84 }
  },
  "D063": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 91, MID: 83, FIN: 79, DNK: 71, HAN: 75, PAS: 69, PDEF: 71, STL: 68, IDEF: 59, BLK: 55, REB: 73, ATH: 73, STR: 67, CLU: 85 }
  },
  "D064": {
    pos: "PF", height: "6'10\"", profile: "interior_forward", ovr: 84,
    attributes: { threePT: 62, MID: 68, FIN: 78, DNK: 82, HAN: 68, PAS: 64, PDEF: 72, STL: 67, IDEF: 80, BLK: 82, REB: 80, ATH: 78, STR: 82, CLU: 74 }
  },
  "D065": {
    pos: "C", height: "7'2\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 68, MID: 70, FIN: 82, DNK: 80, HAN: 54, PAS: 64, PDEF: 58, STL: 57, IDEF: 82, BLK: 86, REB: 86, ATH: 62, STR: 90, CLU: 72 }
  },
  "D066": {
    pos: "PG", height: "6'2\"", profile: "playmaker", ovr: 84,
    attributes: { threePT: 71, MID: 81, FIN: 79, DNK: 61, HAN: 89, PAS: 92, PDEF: 81, STL: 76, IDEF: 31, BLK: 25, REB: 49, ATH: 81, STR: 69, CLU: 87 }
  },
  "D067": {
    pos: "PF", height: "6'9\"", profile: "stretch_four", ovr: 80,
    attributes: { threePT: 81, MID: 79, FIN: 83, DNK: 77, HAN: 67, PAS: 67, PDEF: 69, STL: 61, IDEF: 75, BLK: 79, REB: 77, ATH: 71, STR: 75, CLU: 73 }
  },
  "D068": {
    pos: "SG", height: "6'7\"", profile: "two_way_slasher", ovr: 81,
    attributes: { threePT: 63, MID: 77, FIN: 85, DNK: 81, HAN: 83, PAS: 81, PDEF: 81, STL: 78, IDEF: 53, BLK: 41, REB: 83, ATH: 85, STR: 79, CLU: 79 }
  },
  "D069": {
    pos: "C", height: "6'11\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 74, MID: 72, FIN: 80, DNK: 78, HAN: 56, PAS: 64, PDEF: 64, STL: 61, IDEF: 86, BLK: 92, REB: 82, ATH: 72, STR: 80, CLU: 78 }
  },
  "D070": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 78,
    attributes: { threePT: 64, MID: 70, FIN: 74, DNK: 82, HAN: 76, PAS: 72, PDEF: 90, STL: 76, IDEF: 48, BLK: 44, REB: 72, ATH: 88, STR: 76, CLU: 76 }
  },
  "D071": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 78,
    attributes: { threePT: 78, MID: 78, FIN: 80, DNK: 84, HAN: 76, PAS: 68, PDEF: 74, STL: 69, IDEF: 38, BLK: 30, REB: 64, ATH: 86, STR: 70, CLU: 80 }
  },
  "D072": {
    pos: "PG", height: "6'4\"", profile: "scoring_guard", ovr: 81,
    attributes: { threePT: 79, MID: 81, FIN: 77, DNK: 67, HAN: 83, PAS: 83, PDEF: 77, STL: 75, IDEF: 35, BLK: 25, REB: 57, ATH: 79, STR: 77, CLU: 81 }
  },
  "D073": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 79,
    attributes: { threePT: 87, MID: 77, FIN: 75, DNK: 77, HAN: 75, PAS: 73, PDEF: 81, STL: 76, IDEF: 37, BLK: 27, REB: 65, ATH: 79, STR: 73, CLU: 81 }
  },
  "D074": {
    pos: "SG", height: "6'4\"", profile: "two_way_slasher", ovr: 80,
    attributes: { threePT: 78, MID: 80, FIN: 82, DNK: 86, HAN: 80, PAS: 70, PDEF: 78, STL: 72, IDEF: 40, BLK: 30, REB: 66, ATH: 88, STR: 74, CLU: 80 }
  },
  "D075": {
    pos: "PF", height: "6'9\"", profile: "interior_forward", ovr: 84,
    attributes: { threePT: 77, MID: 81, FIN: 85, DNK: 81, HAN: 73, PAS: 71, PDEF: 77, STL: 71, IDEF: 81, BLK: 79, REB: 83, ATH: 77, STR: 83, CLU: 81 }
  },
  "D076": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 60, MID: 68, FIN: 86, DNK: 84, HAN: 58, PAS: 64, PDEF: 64, STL: 61, IDEF: 80, BLK: 82, REB: 80, ATH: 74, STR: 84, CLU: 76 }
  },
  "D077": {
    pos: "SF", height: "6'8\"", profile: "point_forward", ovr: 79,
    attributes: { threePT: 76, MID: 78, FIN: 78, DNK: 74, HAN: 78, PAS: 76, PDEF: 78, STL: 72, IDEF: 68, BLK: 44, REB: 72, ATH: 76, STR: 74, CLU: 76 }
  },
  "D078": {
    pos: "PG", height: "6'4\"", profile: "playmaker", ovr: 83,
    attributes: { threePT: 84, MID: 78, FIN: 76, DNK: 64, HAN: 84, PAS: 86, PDEF: 82, STL: 79, IDEF: 34, BLK: 25, REB: 58, ATH: 78, STR: 74, CLU: 82 }
  },
  "D079": {
    pos: "SG", height: "6'7\"", profile: "two_way_slasher", ovr: 82,
    attributes: { threePT: 54, MID: 82, FIN: 90, DNK: 86, HAN: 84, PAS: 80, PDEF: 80, STL: 73, IDEF: 56, BLK: 42, REB: 74, ATH: 86, STR: 84, CLU: 86 }
  },
  "D080": {
    pos: "PG", height: "6'3\"", profile: "scoring_guard", ovr: 83,
    attributes: { threePT: 80, MID: 82, FIN: 84, DNK: 78, HAN: 84, PAS: 84, PDEF: 78, STL: 76, IDEF: 34, BLK: 25, REB: 64, ATH: 84, STR: 74, CLU: 80 }
  },
  "D081": {
    pos: "SF", height: "6'9\"", profile: "two_way_wing", ovr: 82,
    attributes: { threePT: 86, MID: 80, FIN: 80, DNK: 82, HAN: 74, PAS: 68, PDEF: 76, STL: 70, IDEF: 70, BLK: 58, REB: 80, ATH: 82, STR: 78, CLU: 80 }
  },
  "D082": {
    pos: "PG", height: "6'5\"", profile: "playmaker", ovr: 84,
    attributes: { threePT: 79, MID: 77, FIN: 77, DNK: 71, HAN: 85, PAS: 87, PDEF: 87, STL: 83, IDEF: 45, BLK: 29, REB: 69, ATH: 81, STR: 77, CLU: 83 }
  },
  "D083": {
    pos: "SF", height: "6'7\"", profile: "point_forward", ovr: 76,
    attributes: { threePT: 64, MID: 72, FIN: 74, DNK: 78, HAN: 76, PAS: 74, PDEF: 78, STL: 72, IDEF: 66, BLK: 44, REB: 74, ATH: 82, STR: 76, CLU: 72 }
  },
  "D084": {
    pos: "SG", height: "6'3\"", profile: "perimeter_scorer", ovr: 85,
    attributes: { threePT: 77, MID: 87, FIN: 89, DNK: 81, HAN: 87, PAS: 79, PDEF: 79, STL: 74, IDEF: 37, BLK: 25, REB: 75, ATH: 85, STR: 83, CLU: 87 }
  },
  "D085": {
    pos: "C", height: "7'1\"", profile: "skilled_big", ovr: 82,
    attributes: { threePT: 80, MID: 80, FIN: 82, DNK: 78, HAN: 64, PAS: 72, PDEF: 66, STL: 61, IDEF: 80, BLK: 82, REB: 80, ATH: 64, STR: 78, CLU: 78 }
  },
  "D086": {
    pos: "C", height: "6'10\"", profile: "skilled_big", ovr: 81,
    attributes: { threePT: 72, MID: 82, FIN: 90, DNK: 80, HAN: 70, PAS: 76, PDEF: 64, STL: 62, IDEF: 78, BLK: 70, REB: 80, ATH: 66, STR: 82, CLU: 84 }
  },
  "D087": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 71, MID: 77, FIN: 83, DNK: 77, HAN: 63, PAS: 71, PDEF: 67, STL: 63, IDEF: 81, BLK: 81, REB: 85, ATH: 71, STR: 83, CLU: 79 }
  },
  "D088": {
    pos: "C", height: "6'11\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 32, MID: 44, FIN: 88, DNK: 88, HAN: 48, PAS: 56, PDEF: 66, STL: 63, IDEF: 86, BLK: 90, REB: 82, ATH: 84, STR: 90, CLU: 76 }
  },
  "D089": {
    pos: "PG", height: "6'1\"", profile: "playmaker", ovr: 83,
    attributes: { threePT: 80, MID: 78, FIN: 78, DNK: 64, HAN: 86, PAS: 88, PDEF: 80, STL: 79, IDEF: 30, BLK: 25, REB: 58, ATH: 82, STR: 64, CLU: 88 }
  },
  "D090": {
    pos: "SG", height: "6'5\"", profile: "perimeter_scorer", ovr: 76,
    attributes: { threePT: 75, MID: 79, FIN: 77, DNK: 79, HAN: 79, PAS: 69, PDEF: 73, STL: 68, IDEF: 39, BLK: 27, REB: 61, ATH: 81, STR: 69, CLU: 77 }
  },
  "D091": {
    pos: "C", height: "6'9\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 53, MID: 61, FIN: 81, DNK: 87, HAN: 57, PAS: 55, PDEF: 65, STL: 60, IDEF: 79, BLK: 81, REB: 81, ATH: 83, STR: 81, CLU: 73 }
  },
  "D092": {
    pos: "C", height: "6'10\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 33, MID: 49, FIN: 83, DNK: 85, HAN: 53, PAS: 55, PDEF: 65, STL: 61, IDEF: 81, BLK: 85, REB: 85, ATH: 79, STR: 81, CLU: 73 }
  },
  "D093": {
    pos: "PG", height: "6'1\"", profile: "scoring_guard", ovr: 83,
    attributes: { threePT: 85, MID: 85, FIN: 85, DNK: 69, HAN: 85, PAS: 83, PDEF: 75, STL: 73, IDEF: 27, BLK: 25, REB: 61, ATH: 83, STR: 67, CLU: 87 }
  },
  "D094": {
    pos: "SG", height: "6'6\"", profile: "two_way_slasher", ovr: 76,
    attributes: { threePT: 65, MID: 69, FIN: 73, DNK: 83, HAN: 71, PAS: 65, PDEF: 81, STL: 73, IDEF: 57, BLK: 57, REB: 71, ATH: 85, STR: 81, CLU: 69 }
  },
  "D095": {
    pos: "PF", height: "6'9\"", profile: "interior_forward", ovr: 81,
    attributes: { threePT: 70, MID: 66, FIN: 82, DNK: 88, HAN: 66, PAS: 60, PDEF: 76, STL: 70, IDEF: 74, BLK: 68, REB: 76, ATH: 88, STR: 76, CLU: 72 }
  },
  "D096": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 82,
    attributes: { threePT: 79, MID: 75, FIN: 81, DNK: 85, HAN: 73, PAS: 67, PDEF: 81, STL: 74, IDEF: 73, BLK: 67, REB: 77, ATH: 87, STR: 79, CLU: 75 }
  },
  "D097": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 85, MID: 71, FIN: 75, DNK: 81, HAN: 71, PAS: 69, PDEF: 79, STL: 72, IDEF: 71, BLK: 53, REB: 69, ATH: 85, STR: 75, CLU: 71 }
  },
  "D098": {
    pos: "PG", height: "6'1\"", profile: "scoring_guard", ovr: 82,
    attributes: { threePT: 80, MID: 82, FIN: 82, DNK: 74, HAN: 86, PAS: 82, PDEF: 74, STL: 75, IDEF: 28, BLK: 25, REB: 58, ATH: 86, STR: 64, CLU: 84 }
  },
  "D099": {
    pos: "PF", height: "6'8\"", profile: "interior_forward", ovr: 84,
    attributes: { threePT: 44, MID: 54, FIN: 82, DNK: 84, HAN: 58, PAS: 64, PDEF: 80, STL: 76, IDEF: 86, BLK: 86, REB: 80, ATH: 82, STR: 86, CLU: 82 }
  },
  "D100": {
    pos: "PF", height: "6'10\"", profile: "stretch_four", ovr: 74,
    attributes: { threePT: 80, MID: 76, FIN: 72, DNK: 74, HAN: 66, PAS: 64, PDEF: 68, STL: 65, IDEF: 70, BLK: 56, REB: 78, ATH: 68, STR: 74, CLU: 76 }
  }
};
