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
    pos: "SF", profile: "two_way_wing", ovr: 82,
    attributes: { threePT: 77, MID: 90, FIN: 90, DNK: 88, HAN: 88, PAS: 80, PDEF: 80, STL: 70, IDEF: 68, BLK: 64, REB: 76, ATH: 90, STR: 78, CLU: 84 }
  },
  "D26-02": {
    pos: "SG", profile: "perimeter_scorer", ovr: 81,
    attributes: { threePT: 85, MID: 92, FIN: 86, DNK: 80, HAN: 88, PAS: 75, PDEF: 80, STL: 72, IDEF: 50, BLK: 44, REB: 60, ATH: 86, STR: 74, CLU: 86 }
  },
  "D26-03": {
    pos: "PF", profile: "interior_forward", ovr: 81,
    attributes: { threePT: 80, MID: 82, FIN: 90, DNK: 74, HAN: 82, PAS: 80, PDEF: 76, STL: 70, IDEF: 80, BLK: 70, REB: 89, ATH: 73, STR: 86, CLU: 82 }
  },
  "D26-04": {
    pos: "PF", profile: "interior_forward", ovr: 81,
    attributes: { threePT: 68, MID: 76, FIN: 88, DNK: 90, HAN: 77, PAS: 74, PDEF: 82, STL: 73, IDEF: 82, BLK: 84, REB: 86, ATH: 89, STR: 72, CLU: 76 }
  },
  "D26-05": {
    pos: "SG", profile: "perimeter_scorer", ovr: 78,
    attributes: { threePT: 90, MID: 88, FIN: 82, DNK: 58, HAN: 88, PAS: 84, PDEF: 76, STL: 62, IDEF: 44, BLK: 36, REB: 62, ATH: 76, STR: 50, CLU: 84 }
  },
  "D26-06": {
    pos: "PG", profile: "playmaker", ovr: 78,
    attributes: { threePT: 82, MID: 86, FIN: 86, DNK: 74, HAN: 90, PAS: 86, PDEF: 70, STL: 65, IDEF: 40, BLK: 34, REB: 52, ATH: 86, STR: 54, CLU: 80 }
  },
  "D26-07": {
    pos: "PG", profile: "playmaker", ovr: 80,
    attributes: { threePT: 88, MID: 86, FIN: 87, DNK: 68, HAN: 90, PAS: 88, PDEF: 70, STL: 59, IDEF: 38, BLK: 30, REB: 48, ATH: 86, STR: 68, CLU: 88 }
  },
  "D26-08": {
    pos: "PG", profile: "playmaker", ovr: 80,
    attributes: { threePT: 85, MID: 82, FIN: 86, DNK: 78, HAN: 88, PAS: 86, PDEF: 84, STL: 66, IDEF: 40, BLK: 34, REB: 56, ATH: 88, STR: 66, CLU: 80 }
  },
  "D26-09": {
    pos: "PF", profile: "interior_forward", ovr: 79,
    attributes: { threePT: 70, MID: 65, FIN: 88, DNK: 86, HAN: 74, PAS: 62, PDEF: 78, STL: 67, IDEF: 80, BLK: 78, REB: 84, ATH: 80, STR: 86, CLU: 72 }
  },
  "D26-10": {
    pos: "SG", profile: "two_way_slasher", ovr: 79,
    attributes: { threePT: 85, MID: 84, FIN: 87, DNK: 80, HAN: 84, PAS: 72, PDEF: 80, STL: 72, IDEF: 48, BLK: 40, REB: 62, ATH: 84, STR: 76, CLU: 78 }
  },
  "D26-11": {
    pos: "PF", profile: "stretch_four", ovr: 78,
    attributes: { threePT: 78, MID: 72, FIN: 83, DNK: 78, HAN: 76, PAS: 74, PDEF: 84, STL: 72, IDEF: 78, BLK: 76, REB: 78, ATH: 78, STR: 78, CLU: 78 }
  },
  "D26-12": {
    pos: "C", profile: "rim_protector", ovr: 78,
    attributes: { threePT: 45, MID: 65, FIN: 86, DNK: 76, HAN: 80, PAS: 74, PDEF: 56, STL: 51, IDEF: 88, BLK: 92, REB: 80, ATH: 58, STR: 80, CLU: 74 }
  },
  "D26-13": {
    pos: "SF", profile: "point_forward", ovr: 76,
    attributes: { threePT: 74, MID: 80, FIN: 84, DNK: 80, HAN: 84, PAS: 80, PDEF: 76, STL: 68, IDEF: 68, BLK: 60, REB: 74, ATH: 84, STR: 60, CLU: 76 }
  },
  "D26-14": {
    pos: "PF", profile: "interior_forward", ovr: 78,
    attributes: { threePT: 70, MID: 74, FIN: 88, DNK: 80, HAN: 78, PAS: 70, PDEF: 68, STL: 64, IDEF: 80, BLK: 76, REB: 90, ATH: 72, STR: 84, CLU: 74 }
  },
  "D26-15": {
    pos: "SF", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 74, MID: 84, FIN: 88, DNK: 82, HAN: 82, PAS: 78, PDEF: 82, STL: 65, IDEF: 64, BLK: 54, REB: 74, ATH: 84, STR: 80, CLU: 78 }
  },
  "D26-16": {
    pos: "PG", profile: "scoring_guard", ovr: 75,
    attributes: { threePT: 84, MID: 88, FIN: 76, DNK: 45, HAN: 88, PAS: 86, PDEF: 68, STL: 58, IDEF: 36, BLK: 30, REB: 44, ATH: 74, STR: 48, CLU: 84 }
  },
  "D26-17": {
    pos: "PG", profile: "scoring_guard", ovr: 76,
    attributes: { threePT: 80, MID: 86, FIN: 88, DNK: 60, HAN: 86, PAS: 76, PDEF: 72, STL: 69, IDEF: 32, BLK: 25, REB: 48, ATH: 86, STR: 70, CLU: 84 }
  },
  "D26-18": {
    pos: "PG", profile: "playmaker", ovr: 75,
    attributes: { threePT: 82, MID: 80, FIN: 78, DNK: 45, HAN: 88, PAS: 90, PDEF: 74, STL: 70, IDEF: 32, BLK: 25, REB: 48, ATH: 82, STR: 54, CLU: 80 }
  },
  "D26-19": {
    pos: "SF", profile: "two_way_wing", ovr: 77,
    attributes: { threePT: 84, MID: 76, FIN: 82, DNK: 80, HAN: 76, PAS: 72, PDEF: 80, STL: 75, IDEF: 72, BLK: 66, REB: 78, ATH: 78, STR: 72, CLU: 74 }
  },
  "D26-20": {
    pos: "C", profile: "rim_protector", ovr: 76,
    attributes: { threePT: 45, MID: 58, FIN: 78, DNK: 82, HAN: 60, PAS: 56, PDEF: 70, STL: 63, IDEF: 82, BLK: 86, REB: 80, ATH: 78, STR: 82, CLU: 70 }
  },
  "D26-21": {
    pos: "SF", profile: "two_way_wing", ovr: 76,
    attributes: { threePT: 78, MID: 76, FIN: 82, DNK: 80, HAN: 72, PAS: 68, PDEF: 82, STL: 72, IDEF: 70, BLK: 72, REB: 76, ATH: 78, STR: 78, CLU: 72 }
  },
  "D26-22": {
    pos: "PG", profile: "playmaker", ovr: 74,
    attributes: { threePT: 80, MID: 82, FIN: 76, DNK: 55, HAN: 86, PAS: 84, PDEF: 72, STL: 60, IDEF: 34, BLK: 28, REB: 46, ATH: 80, STR: 48, CLU: 76 }
  },
  "D26-23": {
    pos: "PF", profile: "interior_forward", ovr: 79,
    attributes: { threePT: 72, MID: 74, FIN: 84, DNK: 78, HAN: 74, PAS: 78, PDEF: 80, STL: 71, IDEF: 80, BLK: 86, REB: 80, ATH: 74, STR: 84, CLU: 78 }
  },
  "D26-24": {
    pos: "SG", profile: "two_way_slasher", ovr: 77,
    attributes: { threePT: 82, MID: 84, FIN: 84, DNK: 80, HAN: 82, PAS: 76, PDEF: 80, STL: 64, IDEF: 42, BLK: 34, REB: 54, ATH: 82, STR: 58, CLU: 78 }
  },
  "D26-25": {
    pos: "PG", profile: "playmaker", ovr: 75,
    attributes: { threePT: 80, MID: 80, FIN: 72, DNK: 60, HAN: 84, PAS: 86, PDEF: 80, STL: 64, IDEF: 44, BLK: 36, REB: 54, ATH: 76, STR: 64, CLU: 76 }
  },
  "D26-26": {
    pos: "C", profile: "rim_protector", ovr: 79,
    attributes: { threePT: 45, MID: 58, FIN: 84, DNK: 82, HAN: 64, PAS: 68, PDEF: 74, STL: 61, IDEF: 84, BLK: 86, REB: 86, ATH: 74, STR: 86, CLU: 76 }
  },
  "D26-27": {
    pos: "C", profile: "skilled_big", ovr: 75,
    attributes: { threePT: 74, MID: 72, FIN: 76, DNK: 76, HAN: 64, PAS: 60, PDEF: 68, STL: 58, IDEF: 76, BLK: 76, REB: 80, ATH: 74, STR: 80, CLU: 72 }
  },
  "D26-28": {
    pos: "PF", profile: "interior_forward", ovr: 79,
    attributes: { threePT: 78, MID: 78, FIN: 82, DNK: 76, HAN: 76, PAS: 78, PDEF: 84, STL: 78, IDEF: 78, BLK: 70, REB: 82, ATH: 74, STR: 86, CLU: 78 }
  },
  "D26-29": {
    pos: "PF", profile: "stretch_four", ovr: 76,
    attributes: { threePT: 84, MID: 80, FIN: 78, DNK: 70, HAN: 74, PAS: 76, PDEF: 80, STL: 64, IDEF: 74, BLK: 62, REB: 78, ATH: 72, STR: 78, CLU: 80 }
  },
  "D26-30": {
    pos: "PF", profile: "interior_forward", ovr: 77,
    attributes: { threePT: 76, MID: 78, FIN: 84, DNK: 82, HAN: 72, PAS: 66, PDEF: 72, STL: 60, IDEF: 76, BLK: 70, REB: 82, ATH: 78, STR: 86, CLU: 74 }
  },
  "D26-31": {
    pos: "PG", profile: "scoring_guard", ovr: 77,
    attributes: { threePT: 86, MID: 88, FIN: 80, DNK: 50, HAN: 86, PAS: 82, PDEF: 72, STL: 66, IDEF: 34, BLK: 25, REB: 58, ATH: 76, STR: 82, CLU: 84 }
  },
  "D26-32": {
    pos: "SG", profile: "perimeter_scorer", ovr: 77,
    attributes: { threePT: 84, MID: 82, FIN: 84, DNK: 76, HAN: 80, PAS: 72, PDEF: 78, STL: 73, IDEF: 46, BLK: 38, REB: 68, ATH: 78, STR: 76, CLU: 80 }
  },
  "D26-33": {
    pos: "SG", profile: "perimeter_scorer", ovr: 71,
    attributes: { threePT: 84, MID: 82, FIN: 72, DNK: 65, HAN: 76, PAS: 68, PDEF: 70, STL: 59, IDEF: 42, BLK: 34, REB: 52, ATH: 74, STR: 54, CLU: 74 }
  },
  "D26-34": {
    pos: "SG", profile: "two_way_slasher", ovr: 75,
    attributes: { threePT: 80, MID: 82, FIN: 78, DNK: 76, HAN: 82, PAS: 76, PDEF: 82, STL: 73, IDEF: 38, BLK: 30, REB: 52, ATH: 86, STR: 62, CLU: 76 }
  },
  "D26-35": {
    pos: "PF", profile: "stretch_four", ovr: 76,
    attributes: { threePT: 80, MID: 76, FIN: 76, DNK: 82, HAN: 72, PAS: 74, PDEF: 70, STL: 59, IDEF: 76, BLK: 74, REB: 82, ATH: 80, STR: 68, CLU: 74 }
  },
  "D26-36": {
    pos: "PF", profile: "stretch_four", ovr: 79,
    attributes: { threePT: 78, MID: 78, FIN: 84, DNK: 82, HAN: 80, PAS: 82, PDEF: 80, STL: 64, IDEF: 80, BLK: 78, REB: 88, ATH: 82, STR: 58, CLU: 78 }
  },
  "D26-37": {
    pos: "SG", profile: "perimeter_scorer", ovr: 76,
    attributes: { threePT: 88, MID: 84, FIN: 80, DNK: 68, HAN: 80, PAS: 72, PDEF: 74, STL: 67, IDEF: 42, BLK: 34, REB: 66, ATH: 74, STR: 78, CLU: 82 }
  },
  "D26-38": {
    pos: "PG", profile: "playmaker", ovr: 76,
    attributes: { threePT: 82, MID: 80, FIN: 80, DNK: 40, HAN: 88, PAS: 94, PDEF: 78, STL: 72, IDEF: 28, BLK: 25, REB: 48, ATH: 74, STR: 56, CLU: 84 }
  },
  "D26-39": {
    pos: "PG", profile: "playmaker", ovr: 76,
    attributes: { threePT: 72, MID: 76, FIN: 82, DNK: 72, HAN: 82, PAS: 84, PDEF: 80, STL: 64, IDEF: 44, BLK: 34, REB: 54, ATH: 84, STR: 70, CLU: 74 }
  },
  "D26-40": {
    pos: "SF", profile: "point_forward", ovr: 79,
    attributes: { threePT: 70, MID: 72, FIN: 82, DNK: 88, HAN: 76, PAS: 78, PDEF: 84, STL: 73, IDEF: 80, BLK: 76, REB: 82, ATH: 88, STR: 66, CLU: 76 }
  },
  "D26-41": {
    pos: "SG", profile: "two_way_slasher", ovr: 77,
    attributes: { threePT: 76, MID: 82, FIN: 86, DNK: 80, HAN: 80, PAS: 72, PDEF: 80, STL: 74, IDEF: 44, BLK: 34, REB: 62, ATH: 82, STR: 82, CLU: 78 }
  },
  "D26-42": {
    pos: "PG", profile: "playmaker", ovr: 75,
    attributes: { threePT: 82, MID: 82, FIN: 82, DNK: 48, HAN: 86, PAS: 86, PDEF: 74, STL: 61, IDEF: 32, BLK: 25, REB: 54, ATH: 76, STR: 66, CLU: 80 }
  },
  "D26-43": {
    pos: "PF", profile: "stretch_four", ovr: 71,
    attributes: { threePT: 68, MID: 76, FIN: 76, DNK: 68, HAN: 74, PAS: 78, PDEF: 68, STL: 58, IDEF: 72, BLK: 64, REB: 70, ATH: 68, STR: 70, CLU: 74 }
  },
  "D26-44": {
    pos: "PF", profile: "interior_forward", ovr: 75,
    attributes: { threePT: 62, MID: 68, FIN: 76, DNK: 72, HAN: 72, PAS: 78, PDEF: 78, STL: 63, IDEF: 82, BLK: 80, REB: 74, ATH: 76, STR: 72, CLU: 76 }
  },
  "D26-45": {
    pos: "SG", profile: "perimeter_scorer", ovr: 73,
    attributes: { threePT: 84, MID: 82, FIN: 76, DNK: 58, HAN: 80, PAS: 68, PDEF: 76, STL: 69, IDEF: 36, BLK: 28, REB: 50, ATH: 74, STR: 78, CLU: 84 }
  },
  "D26-46": {
    pos: "C", profile: "skilled_big", ovr: 76,
    attributes: { threePT: 42, MID: 58, FIN: 82, DNK: 84, HAN: 66, PAS: 72, PDEF: 68, STL: 58, IDEF: 80, BLK: 84, REB: 78, ATH: 76, STR: 78, CLU: 74 }
  },
  "D26-47": {
    pos: "SF", profile: "two_way_wing", ovr: 71,
    attributes: { threePT: 72, MID: 76, FIN: 76, DNK: 70, HAN: 70, PAS: 62, PDEF: 82, STL: 65, IDEF: 64, BLK: 52, REB: 58, ATH: 72, STR: 78, CLU: 72 }
  },
  "D26-48": {
    pos: "PF", profile: "interior_forward", ovr: 77,
    attributes: { threePT: 58, MID: 68, FIN: 86, DNK: 88, HAN: 72, PAS: 68, PDEF: 82, STL: 65, IDEF: 78, BLK: 76, REB: 86, ATH: 88, STR: 70, CLU: 74 }
  },
  "D26-49": {
    pos: "SF", profile: "two_way_wing", ovr: 74,
    attributes: { threePT: 82, MID: 80, FIN: 82, DNK: 72, HAN: 76, PAS: 72, PDEF: 74, STL: 67, IDEF: 62, BLK: 50, REB: 74, ATH: 72, STR: 80, CLU: 76 }
  },
  "D26-50": {
    pos: "PG", profile: "playmaker", ovr: 77,
    attributes: { threePT: 86, MID: 82, FIN: 78, DNK: 60, HAN: 84, PAS: 84, PDEF: 78, STL: 71, IDEF: 36, BLK: 28, REB: 56, ATH: 82, STR: 78, CLU: 80 }
  },
  "D26-51": {
    pos: "C", profile: "rim_protector", ovr: 78,
    attributes: { threePT: 35, MID: 56, FIN: 88, DNK: 84, HAN: 62, PAS: 60, PDEF: 78, STL: 72, IDEF: 84, BLK: 82, REB: 90, ATH: 76, STR: 78, CLU: 76 }
  },
  "D26-52": {
    pos: "C", profile: "skilled_big", ovr: 78,
    attributes: { threePT: 88, MID: 82, FIN: 90, DNK: 78, HAN: 70, PAS: 72, PDEF: 68, STL: 58, IDEF: 76, BLK: 74, REB: 84, ATH: 68, STR: 72, CLU: 76 }
  },
  "D26-53": {
    pos: "C", profile: "rim_protector", ovr: 76,
    attributes: { threePT: 58, MID: 60, FIN: 72, DNK: 78, HAN: 56, PAS: 50, PDEF: 76, STL: 62, IDEF: 86, BLK: 94, REB: 76, ATH: 84, STR: 72, CLU: 72 }
  },
  "D26-54": {
    pos: "SF", profile: "two_way_wing", ovr: 75,
    attributes: { threePT: 78, MID: 78, FIN: 80, DNK: 76, HAN: 74, PAS: 62, PDEF: 82, STL: 72, IDEF: 68, BLK: 66, REB: 72, ATH: 76, STR: 82, CLU: 72 }
  },
  "D26-55": {
    pos: "PF", profile: "stretch_four", ovr: 75,
    attributes: { threePT: 78, MID: 80, FIN: 82, DNK: 72, HAN: 76, PAS: 74, PDEF: 72, STL: 60, IDEF: 70, BLK: 62, REB: 78, ATH: 70, STR: 82, CLU: 76 }
  },
  "D26-56": {
    pos: "SF", profile: "two_way_wing", ovr: 76,
    attributes: { threePT: 90, MID: 84, FIN: 78, DNK: 68, HAN: 78, PAS: 74, PDEF: 82, STL: 72, IDEF: 66, BLK: 54, REB: 70, ATH: 74, STR: 78, CLU: 76 }
  },
  "D26-57": {
    pos: "C", profile: "rim_protector", ovr: 81,
    attributes: { threePT: 58, MID: 64, FIN: 84, DNK: 82, HAN: 60, PAS: 66, PDEF: 68, STL: 58, IDEF: 88, BLK: 90, REB: 92, ATH: 70, STR: 88, CLU: 76 }
  },
  "D26-58": {
    pos: "SG", profile: "perimeter_scorer", ovr: 78,
    attributes: { threePT: 84, MID: 84, FIN: 82, DNK: 72, HAN: 82, PAS: 80, PDEF: 80, STL: 64, IDEF: 50, BLK: 38, REB: 66, ATH: 76, STR: 80, CLU: 82 }
  },
  "D26-59": {
    pos: "PF", profile: "interior_forward", ovr: 77,
    attributes: { threePT: 76, MID: 78, FIN: 86, DNK: 76, HAN: 72, PAS: 64, PDEF: 70, STL: 59, IDEF: 78, BLK: 70, REB: 84, ATH: 68, STR: 86, CLU: 78 }
  },
  "D26-60": {
    pos: "SF", profile: "two_way_wing", ovr: 74,
    attributes: { threePT: 82, MID: 78, FIN: 78, DNK: 76, HAN: 76, PAS: 74, PDEF: 80, STL: 70, IDEF: 62, BLK: 52, REB: 68, ATH: 84, STR: 56, CLU: 74 }
  }
};

// 2027 届及后续候选人逐人审核后的固定能力；未列入者继续使用原随机模板。
var FUTURE_PROSPECT_RATINGS = {
  "D001": {
    pos: "SG", height: "6'2\"", profile: "two_way_slasher", ovr: 83,
    attributes: { threePT: 84, MID: 88, FIN: 90, DNK: 82, HAN: 88, PAS: 84, PDEF: 88, STL: 86, IDEF: 44, BLK: 34, REB: 66, ATH: 88, STR: 82, CLU: 84 }
  },
  "D002": {
    pos: "SF", height: "6'8\"", profile: "point_forward", ovr: 84,
    attributes: { threePT: 76, MID: 82, FIN: 90, DNK: 88, HAN: 86, PAS: 86, PDEF: 86, STL: 86, IDEF: 80, BLK: 74, REB: 88, ATH: 88, STR: 86, CLU: 84 }
  },
  "D003": {
    pos: "SF", height: "6'7\"", profile: "point_forward", ovr: 81,
    attributes: { threePT: 86, MID: 90, FIN: 88, DNK: 78, HAN: 88, PAS: 84, PDEF: 80, STL: 71, IDEF: 68, BLK: 60, REB: 74, ATH: 82, STR: 70, CLU: 88 }
  },
  "D004": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 82,
    attributes: { threePT: 76, MID: 80, FIN: 84, DNK: 88, HAN: 82, PAS: 78, PDEF: 88, STL: 76, IDEF: 76, BLK: 76, REB: 86, ATH: 90, STR: 74, CLU: 78 }
  },
  "D005": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 80,
    attributes: { threePT: 80, MID: 82, FIN: 86, DNK: 88, HAN: 82, PAS: 76, PDEF: 86, STL: 74, IDEF: 48, BLK: 40, REB: 68, ATH: 90, STR: 80, CLU: 80 }
  },
  "D006": {
    pos: "SG", height: "6'6\"", profile: "perimeter_scorer", ovr: 74,
    attributes: { threePT: 82, MID: 80, FIN: 76, DNK: 72, HAN: 78, PAS: 68, PDEF: 76, STL: 68, IDEF: 42, BLK: 34, REB: 58, ATH: 80, STR: 62, CLU: 84 }
  },
  "D007": {
    pos: "PF", height: "6'9\"", profile: "stretch_four", ovr: 81,
    attributes: { threePT: 80, MID: 84, FIN: 86, DNK: 80, HAN: 80, PAS: 80, PDEF: 84, STL: 72, IDEF: 82, BLK: 78, REB: 82, ATH: 80, STR: 74, CLU: 86 }
  },
  "D008": {
    pos: "C", height: "7'1\"", profile: "rim_protector", ovr: 74,
    attributes: { threePT: 58, MID: 64, FIN: 76, DNK: 82, HAN: 58, PAS: 58, PDEF: 64, STL: 58, IDEF: 78, BLK: 80, REB: 80, ATH: 72, STR: 78, CLU: 70 }
  },
  "D009": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 81,
    attributes: { threePT: 78, MID: 82, FIN: 86, DNK: 86, HAN: 80, PAS: 70, PDEF: 84, STL: 74, IDEF: 78, BLK: 72, REB: 80, ATH: 88, STR: 82, CLU: 78 }
  },
  "D010": {
    pos: "C", height: "6'11\"", profile: "rim_protector", ovr: 76,
    attributes: { threePT: 66, MID: 70, FIN: 76, DNK: 84, HAN: 60, PAS: 62, PDEF: 70, STL: 64, IDEF: 82, BLK: 88, REB: 76, ATH: 82, STR: 68, CLU: 72 }
  },
  "D011": {
    pos: "SG", height: "6'6\"", profile: "two_way_slasher", ovr: 75,
    attributes: { threePT: 70, MID: 80, FIN: 82, DNK: 84, HAN: 82, PAS: 74, PDEF: 76, STL: 68, IDEF: 46, BLK: 40, REB: 62, ATH: 86, STR: 68, CLU: 78 }
  },
  "D012": {
    pos: "C", height: "7'2\"", profile: "rim_protector", ovr: 81,
    attributes: { threePT: 58, MID: 70, FIN: 84, DNK: 82, HAN: 60, PAS: 68, PDEF: 68, STL: 61, IDEF: 88, BLK: 90, REB: 88, ATH: 74, STR: 86, CLU: 82 }
  },
  "D013": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 73,
    attributes: { threePT: 50, MID: 62, FIN: 78, DNK: 84, HAN: 56, PAS: 58, PDEF: 64, STL: 59, IDEF: 78, BLK: 78, REB: 76, ATH: 74, STR: 78, CLU: 66 }
  },
  "D014": {
    pos: "PF", height: "6'8\"", profile: "interior_forward", ovr: 78,
    attributes: { threePT: 62, MID: 70, FIN: 80, DNK: 86, HAN: 66, PAS: 62, PDEF: 76, STL: 65, IDEF: 84, BLK: 86, REB: 84, ATH: 82, STR: 82, CLU: 76 }
  },
  "D015": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 82,
    attributes: { threePT: 84, MID: 84, FIN: 88, DNK: 90, HAN: 82, PAS: 76, PDEF: 84, STL: 77, IDEF: 52, BLK: 62, REB: 72, ATH: 90, STR: 82, CLU: 84 }
  },
  "D016": {
    pos: "SF", height: "6'9\"", profile: "two_way_wing", ovr: 82,
    attributes: { threePT: 72, MID: 80, FIN: 86, DNK: 92, HAN: 78, PAS: 76, PDEF: 84, STL: 74, IDEF: 80, BLK: 76, REB: 88, ATH: 94, STR: 80, CLU: 82 }
  },
  "D017": {
    pos: "PG", height: "6'4\"", profile: "playmaker", ovr: 81,
    attributes: { threePT: 76, MID: 82, FIN: 86, DNK: 84, HAN: 88, PAS: 84, PDEF: 84, STL: 79, IDEF: 48, BLK: 38, REB: 78, ATH: 88, STR: 72, CLU: 82 }
  },
  "D018": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 80,
    attributes: { threePT: 70, MID: 78, FIN: 86, DNK: 92, HAN: 84, PAS: 82, PDEF: 88, STL: 76, IDEF: 52, BLK: 48, REB: 68, ATH: 94, STR: 76, CLU: 80 }
  },
  "D019": {
    pos: "SF", height: "6'8\"", profile: "point_forward", ovr: 77,
    attributes: { threePT: 78, MID: 80, FIN: 82, DNK: 78, HAN: 80, PAS: 82, PDEF: 78, STL: 70, IDEF: 72, BLK: 58, REB: 80, ATH: 78, STR: 70, CLU: 80 }
  },
  "D020": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 77,
    attributes: { threePT: 58, MID: 68, FIN: 80, DNK: 82, HAN: 60, PAS: 66, PDEF: 66, STL: 59, IDEF: 82, BLK: 84, REB: 82, ATH: 72, STR: 82, CLU: 84 }
  },
  "D021": {
    pos: "C", height: "6'10\"", profile: "rim_protector", ovr: 83,
    attributes: { threePT: 48, MID: 64, FIN: 84, DNK: 86, HAN: 58, PAS: 56, PDEF: 72, STL: 63, IDEF: 94, BLK: 90, REB: 96, ATH: 80, STR: 94, CLU: 88 }
  },
  "D022": {
    pos: "C", height: "6'11\"", profile: "skilled_big", ovr: 78,
    attributes: { threePT: 68, MID: 76, FIN: 88, DNK: 84, HAN: 62, PAS: 58, PDEF: 66, STL: 59, IDEF: 80, BLK: 78, REB: 80, ATH: 76, STR: 82, CLU: 80 }
  },
  "D023": {
    pos: "SF", height: "6'9\"", profile: "two_way_wing", ovr: 83,
    attributes: { threePT: 80, MID: 86, FIN: 88, DNK: 84, HAN: 84, PAS: 76, PDEF: 82, STL: 72, IDEF: 82, BLK: 82, REB: 80, ATH: 84, STR: 78, CLU: 84 }
  },
  "D024": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 82,
    attributes: { threePT: 74, MID: 84, FIN: 88, DNK: 92, HAN: 82, PAS: 70, PDEF: 88, STL: 79, IDEF: 50, BLK: 54, REB: 78, ATH: 92, STR: 88, CLU: 86 }
  },
  "D025": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 86, MID: 82, FIN: 84, DNK: 82, HAN: 82, PAS: 72, PDEF: 86, STL: 75, IDEF: 68, BLK: 62, REB: 68, ATH: 88, STR: 68, CLU: 82 }
  },
  "D026": {
    pos: "C", height: "7'2\"", profile: "rim_protector", ovr: 81,
    attributes: { threePT: 72, MID: 74, FIN: 82, DNK: 84, HAN: 60, PAS: 62, PDEF: 70, STL: 62, IDEF: 86, BLK: 94, REB: 82, ATH: 78, STR: 84, CLU: 80 }
  },
  "D027": {
    pos: "SF", height: "6'10\"", profile: "point_forward", ovr: 80,
    attributes: { threePT: 78, MID: 84, FIN: 86, DNK: 84, HAN: 82, PAS: 78, PDEF: 82, STL: 80, IDEF: 76, BLK: 70, REB: 78, ATH: 84, STR: 64, CLU: 82 }
  },
  "D028": {
    pos: "C", height: "7'1\"", profile: "skilled_big", ovr: 82,
    attributes: { threePT: 76, MID: 80, FIN: 88, DNK: 86, HAN: 66, PAS: 62, PDEF: 72, STL: 63, IDEF: 86, BLK: 92, REB: 80, ATH: 82, STR: 78, CLU: 82 }
  },
  "D029": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 77,
    attributes: { threePT: 84, MID: 82, FIN: 84, DNK: 76, HAN: 80, PAS: 68, PDEF: 78, STL: 69, IDEF: 46, BLK: 34, REB: 68, ATH: 78, STR: 84, CLU: 84 }
  },
  "D030": {
    pos: "SF", height: "6'6\"", profile: "two_way_wing", ovr: 81,
    attributes: { threePT: 74, MID: 82, FIN: 90, DNK: 88, HAN: 80, PAS: 74, PDEF: 82, STL: 72, IDEF: 76, BLK: 62, REB: 76, ATH: 86, STR: 92, CLU: 82 }
  },
  "D031": {
    pos: "SF", height: "6'8\"", profile: "point_forward", ovr: 77,
    attributes: { threePT: 80, MID: 82, FIN: 84, DNK: 80, HAN: 80, PAS: 76, PDEF: 76, STL: 68, IDEF: 70, BLK: 58, REB: 80, ATH: 78, STR: 68, CLU: 80 }
  },
  "D032": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 76,
    attributes: { threePT: 54, MID: 64, FIN: 76, DNK: 84, HAN: 54, PAS: 54, PDEF: 62, STL: 57, IDEF: 82, BLK: 88, REB: 82, ATH: 72, STR: 82, CLU: 72 }
  },
  "D033": {
    pos: "SG", height: "6'4\"", profile: "two_way_slasher", ovr: 82,
    attributes: { threePT: 88, MID: 88, FIN: 88, DNK: 78, HAN: 84, PAS: 80, PDEF: 86, STL: 82, IDEF: 46, BLK: 34, REB: 70, ATH: 84, STR: 66, CLU: 92 }
  },
  "D034": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 75,
    attributes: { threePT: 96, MID: 90, FIN: 80, DNK: 66, HAN: 76, PAS: 64, PDEF: 74, STL: 67, IDEF: 62, BLK: 50, REB: 66, ATH: 68, STR: 72, CLU: 90 }
  },
  "D035": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 83,
    attributes: { threePT: 82, MID: 86, FIN: 88, DNK: 90, HAN: 86, PAS: 80, PDEF: 88, STL: 81, IDEF: 50, BLK: 40, REB: 76, ATH: 92, STR: 78, CLU: 86 }
  },
  "D036": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 81,
    attributes: { threePT: 48, MID: 66, FIN: 88, DNK: 90, HAN: 54, PAS: 58, PDEF: 64, STL: 58, IDEF: 86, BLK: 86, REB: 90, ATH: 76, STR: 94, CLU: 78 }
  },
  "D037": {
    pos: "PF", height: "6'9\"", profile: "stretch_four", ovr: 83,
    attributes: { threePT: 80, MID: 84, FIN: 88, DNK: 82, HAN: 78, PAS: 80, PDEF: 80, STL: 70, IDEF: 84, BLK: 72, REB: 88, ATH: 76, STR: 90, CLU: 86 }
  },
  "D038": {
    pos: "C", height: "7'0\"", profile: "skilled_big", ovr: 77,
    attributes: { threePT: 48, MID: 68, FIN: 90, DNK: 84, HAN: 56, PAS: 56, PDEF: 62, STL: 57, IDEF: 80, BLK: 80, REB: 84, ATH: 70, STR: 88, CLU: 80 }
  },
  "D039": {
    pos: "SF", height: "6'9\"", profile: "point_forward", ovr: 78,
    attributes: { threePT: 80, MID: 84, FIN: 84, DNK: 74, HAN: 86, PAS: 88, PDEF: 78, STL: 70, IDEF: 62, BLK: 54, REB: 72, ATH: 78, STR: 72, CLU: 84 }
  },
  "D040": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 72, MID: 78, FIN: 84, DNK: 80, HAN: 82, PAS: 80, PDEF: 86, STL: 75, IDEF: 72, BLK: 62, REB: 80, ATH: 82, STR: 84, CLU: 82 }
  },
  "D041": {
    pos: "PF", height: "6'11\"", profile: "interior_forward", ovr: 83,
    attributes: { threePT: 64, MID: 78, FIN: 90, DNK: 86, HAN: 78, PAS: 84, PDEF: 82, STL: 71, IDEF: 88, BLK: 86, REB: 86, ATH: 78, STR: 88, CLU: 86 }
  },
  "D042": {
    pos: "PF", height: "7'0\"", profile: "stretch_four", ovr: 76,
    attributes: { threePT: 76, MID: 76, FIN: 80, DNK: 90, HAN: 78, PAS: 70, PDEF: 76, STL: 67, IDEF: 72, BLK: 70, REB: 72, ATH: 92, STR: 64, CLU: 76 }
  },
  "D043": {
    pos: "C", height: "7'4\"", profile: "rim_protector", ovr: 78,
    attributes: { threePT: 58, MID: 64, FIN: 86, DNK: 84, HAN: 58, PAS: 58, PDEF: 64, STL: 58, IDEF: 82, BLK: 92, REB: 78, ATH: 66, STR: 88, CLU: 76 }
  },
  "D044": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 77,
    attributes: { threePT: 58, MID: 68, FIN: 88, DNK: 92, HAN: 74, PAS: 68, PDEF: 84, STL: 74, IDEF: 70, BLK: 62, REB: 76, ATH: 94, STR: 84, CLU: 78 }
  },
  "D045": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 77,
    attributes: { threePT: 82, MID: 80, FIN: 82, DNK: 82, HAN: 78, PAS: 68, PDEF: 84, STL: 73, IDEF: 44, BLK: 34, REB: 66, ATH: 86, STR: 74, CLU: 78 }
  },
  "D046": {
    pos: "SF", height: "6'6\"", profile: "two_way_wing", ovr: 80,
    attributes: { threePT: 66, MID: 74, FIN: 88, DNK: 98, HAN: 72, PAS: 68, PDEF: 86, STL: 75, IDEF: 74, BLK: 64, REB: 80, ATH: 98, STR: 90, CLU: 80 }
  },
  "D047": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 82,
    attributes: { threePT: 90, MID: 88, FIN: 86, DNK: 76, HAN: 84, PAS: 76, PDEF: 82, STL: 72, IDEF: 42, BLK: 30, REB: 78, ATH: 84, STR: 82, CLU: 90 }
  },
  "D048": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 76,
    attributes: { threePT: 82, MID: 82, FIN: 78, DNK: 76, HAN: 82, PAS: 80, PDEF: 76, STL: 68, IDEF: 42, BLK: 32, REB: 58, ATH: 82, STR: 64, CLU: 78 }
  },
  "D049": {
    pos: "SF", height: "6'7\"", profile: "point_forward", ovr: 77,
    attributes: { threePT: 62, MID: 88, FIN: 90, DNK: 80, HAN: 82, PAS: 68, PDEF: 76, STL: 68, IDEF: 68, BLK: 54, REB: 78, ATH: 82, STR: 80, CLU: 86 }
  },
  "D050": {
    pos: "SG", height: "6'5\"", profile: "perimeter_scorer", ovr: 75,
    attributes: { threePT: 94, MID: 84, FIN: 78, DNK: 70, HAN: 76, PAS: 62, PDEF: 72, STL: 65, IDEF: 40, BLK: 32, REB: 66, ATH: 76, STR: 66, CLU: 84 }
  },
  "D051": {
    pos: "PF", height: "6'10\"", profile: "interior_forward", ovr: 81,
    attributes: { threePT: 72, MID: 74, FIN: 84, DNK: 82, HAN: 72, PAS: 72, PDEF: 78, STL: 69, IDEF: 86, BLK: 90, REB: 86, ATH: 78, STR: 82, CLU: 78 }
  },
  "D052": {
    pos: "PG", height: "6'0\"", profile: "playmaker", ovr: 84,
    attributes: { threePT: 84, MID: 88, FIN: 84, DNK: 70, HAN: 92, PAS: 94, PDEF: 94, STL: 85, IDEF: 40, BLK: 28, REB: 60, ATH: 92, STR: 68, CLU: 94 }
  },
  "D053": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 82,
    attributes: { threePT: 86, MID: 90, FIN: 90, DNK: 82, HAN: 84, PAS: 74, PDEF: 82, STL: 72, IDEF: 66, BLK: 56, REB: 86, ATH: 84, STR: 76, CLU: 90 }
  },
  "D054": {
    pos: "C", height: "6'10\"", profile: "rim_protector", ovr: 86,
    attributes: { threePT: 42, MID: 58, FIN: 94, DNK: 94, HAN: 60, PAS: 68, PDEF: 78, STL: 67, IDEF: 92, BLK: 96, REB: 94, ATH: 94, STR: 90, CLU: 84 }
  },
  "D055": {
    pos: "PG", height: "6'4\"", profile: "playmaker", ovr: 80,
    attributes: { threePT: 74, MID: 80, FIN: 82, DNK: 78, HAN: 88, PAS: 92, PDEF: 84, STL: 76, IDEF: 42, BLK: 30, REB: 64, ATH: 86, STR: 78, CLU: 84 }
  },
  "D056": {
    pos: "SF", height: "6'5\"", profile: "point_forward", ovr: 77,
    attributes: { threePT: 70, MID: 76, FIN: 78, DNK: 80, HAN: 82, PAS: 86, PDEF: 82, STL: 72, IDEF: 70, BLK: 60, REB: 76, ATH: 86, STR: 74, CLU: 78 }
  },
  "D057": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 72, MID: 76, FIN: 80, DNK: 82, HAN: 80, PAS: 82, PDEF: 84, STL: 74, IDEF: 76, BLK: 72, REB: 82, ATH: 86, STR: 76, CLU: 80 }
  },
  "D058": {
    pos: "SF", height: "6'6\"", profile: "two_way_wing", ovr: 85,
    attributes: { threePT: 78, MID: 84, FIN: 92, DNK: 90, HAN: 82, PAS: 78, PDEF: 86, STL: 80, IDEF: 76, BLK: 68, REB: 94, ATH: 90, STR: 90, CLU: 88 }
  },
  "D059": {
    pos: "C", height: "7'1\"", profile: "skilled_big", ovr: 79,
    attributes: { threePT: 78, MID: 82, FIN: 84, DNK: 80, HAN: 68, PAS: 78, PDEF: 66, STL: 59, IDEF: 80, BLK: 76, REB: 84, ATH: 64, STR: 90, CLU: 80 }
  },
  "D060": {
    pos: "C", height: "6'11\"", profile: "skilled_big", ovr: 82,
    attributes: { threePT: 66, MID: 72, FIN: 88, DNK: 86, HAN: 64, PAS: 72, PDEF: 70, STL: 62, IDEF: 86, BLK: 84, REB: 86, ATH: 72, STR: 94, CLU: 80 }
  },
  "D061": {
    pos: "PF", height: "6'9\"", profile: "interior_forward", ovr: 88,
    attributes: { threePT: 66, MID: 82, FIN: 96, DNK: 92, HAN: 80, PAS: 76, PDEF: 86, STL: 74, IDEF: 92, BLK: 88, REB: 96, ATH: 90, STR: 94, CLU: 90 }
  },
  "D062": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 81,
    attributes: { threePT: 78, MID: 86, FIN: 88, DNK: 82, HAN: 88, PAS: 82, PDEF: 84, STL: 73, IDEF: 44, BLK: 32, REB: 72, ATH: 84, STR: 76, CLU: 88 }
  },
  "D063": {
    pos: "SF", height: "6'7\"", profile: "two_way_wing", ovr: 79,
    attributes: { threePT: 96, MID: 88, FIN: 84, DNK: 76, HAN: 80, PAS: 74, PDEF: 76, STL: 68, IDEF: 64, BLK: 60, REB: 78, ATH: 78, STR: 72, CLU: 90 }
  },
  "D064": {
    pos: "PF", height: "6'10\"", profile: "interior_forward", ovr: 80,
    attributes: { threePT: 66, MID: 72, FIN: 82, DNK: 86, HAN: 72, PAS: 68, PDEF: 76, STL: 67, IDEF: 84, BLK: 86, REB: 84, ATH: 82, STR: 86, CLU: 78 }
  },
  "D065": {
    pos: "C", height: "7'2\"", profile: "rim_protector", ovr: 82,
    attributes: { threePT: 72, MID: 74, FIN: 86, DNK: 84, HAN: 58, PAS: 68, PDEF: 62, STL: 57, IDEF: 86, BLK: 90, REB: 90, ATH: 66, STR: 94, CLU: 76 }
  },
  "D066": {
    pos: "PG", height: "6'2\"", profile: "playmaker", ovr: 84,
    attributes: { threePT: 78, MID: 88, FIN: 86, DNK: 68, HAN: 96, PAS: 99, PDEF: 88, STL: 76, IDEF: 38, BLK: 28, REB: 56, ATH: 88, STR: 76, CLU: 94 }
  },
  "D067": {
    pos: "PF", height: "6'9\"", profile: "stretch_four", ovr: 79,
    attributes: { threePT: 84, MID: 82, FIN: 86, DNK: 80, HAN: 70, PAS: 70, PDEF: 72, STL: 61, IDEF: 78, BLK: 82, REB: 80, ATH: 74, STR: 78, CLU: 76 }
  },
  "D068": {
    pos: "SG", height: "6'7\"", profile: "two_way_slasher", ovr: 82,
    attributes: { threePT: 68, MID: 82, FIN: 90, DNK: 86, HAN: 88, PAS: 86, PDEF: 86, STL: 78, IDEF: 58, BLK: 46, REB: 88, ATH: 90, STR: 84, CLU: 84 }
  },
  "D069": {
    pos: "C", height: "6'11\"", profile: "rim_protector", ovr: 83,
    attributes: { threePT: 78, MID: 76, FIN: 84, DNK: 82, HAN: 60, PAS: 68, PDEF: 68, STL: 61, IDEF: 90, BLK: 96, REB: 86, ATH: 76, STR: 84, CLU: 82 }
  },
  "D070": {
    pos: "SG", height: "6'5\"", profile: "two_way_slasher", ovr: 78,
    attributes: { threePT: 68, MID: 74, FIN: 78, DNK: 86, HAN: 80, PAS: 76, PDEF: 94, STL: 76, IDEF: 52, BLK: 48, REB: 76, ATH: 92, STR: 80, CLU: 80 }
  },
  "D071": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 79,
    attributes: { threePT: 82, MID: 82, FIN: 84, DNK: 88, HAN: 80, PAS: 72, PDEF: 78, STL: 69, IDEF: 42, BLK: 34, REB: 68, ATH: 90, STR: 74, CLU: 84 }
  },
  "D072": {
    pos: "PG", height: "6'4\"", profile: "scoring_guard", ovr: 81,
    attributes: { threePT: 84, MID: 86, FIN: 82, DNK: 72, HAN: 88, PAS: 88, PDEF: 82, STL: 75, IDEF: 40, BLK: 28, REB: 62, ATH: 84, STR: 82, CLU: 86 }
  },
  "D073": {
    pos: "SG", height: "6'4\"", profile: "perimeter_scorer", ovr: 82,
    attributes: { threePT: 94, MID: 84, FIN: 82, DNK: 84, HAN: 82, PAS: 80, PDEF: 88, STL: 76, IDEF: 44, BLK: 34, REB: 72, ATH: 86, STR: 80, CLU: 88 }
  },
  "D074": {
    pos: "SG", height: "6'4\"", profile: "two_way_slasher", ovr: 81,
    attributes: { threePT: 82, MID: 84, FIN: 86, DNK: 90, HAN: 84, PAS: 74, PDEF: 82, STL: 72, IDEF: 44, BLK: 34, REB: 70, ATH: 92, STR: 78, CLU: 84 }
  },
  "D075": {
    pos: "PF", height: "6'9\"", profile: "interior_forward", ovr: 85,
    attributes: { threePT: 82, MID: 86, FIN: 90, DNK: 86, HAN: 78, PAS: 76, PDEF: 82, STL: 71, IDEF: 86, BLK: 84, REB: 88, ATH: 82, STR: 88, CLU: 86 }
  },
  "D076": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 81,
    attributes: { threePT: 64, MID: 72, FIN: 90, DNK: 88, HAN: 62, PAS: 68, PDEF: 68, STL: 61, IDEF: 84, BLK: 86, REB: 84, ATH: 78, STR: 88, CLU: 80 }
  },
  "D077": {
    pos: "SF", height: "6'8\"", profile: "point_forward", ovr: 78,
    attributes: { threePT: 80, MID: 82, FIN: 82, DNK: 78, HAN: 82, PAS: 80, PDEF: 82, STL: 72, IDEF: 72, BLK: 48, REB: 76, ATH: 80, STR: 78, CLU: 80 }
  },
  "D078": {
    pos: "PG", height: "6'4\"", profile: "playmaker", ovr: 83,
    attributes: { threePT: 90, MID: 84, FIN: 82, DNK: 70, HAN: 90, PAS: 92, PDEF: 88, STL: 79, IDEF: 40, BLK: 28, REB: 64, ATH: 84, STR: 80, CLU: 88 }
  },
  "D079": {
    pos: "SG", height: "6'7\"", profile: "two_way_slasher", ovr: 82,
    attributes: { threePT: 58, MID: 86, FIN: 94, DNK: 90, HAN: 88, PAS: 84, PDEF: 84, STL: 73, IDEF: 60, BLK: 46, REB: 78, ATH: 90, STR: 88, CLU: 90 }
  },
  "D080": {
    pos: "PG", height: "6'3\"", profile: "scoring_guard", ovr: 84,
    attributes: { threePT: 86, MID: 88, FIN: 90, DNK: 84, HAN: 90, PAS: 90, PDEF: 84, STL: 76, IDEF: 40, BLK: 28, REB: 70, ATH: 90, STR: 80, CLU: 86 }
  },
  "D081": {
    pos: "SF", height: "6'9\"", profile: "two_way_wing", ovr: 80,
    attributes: { threePT: 88, MID: 82, FIN: 82, DNK: 84, HAN: 76, PAS: 70, PDEF: 78, STL: 70, IDEF: 72, BLK: 60, REB: 82, ATH: 84, STR: 80, CLU: 82 }
  },
  "D082": {
    pos: "PG", height: "6'5\"", profile: "playmaker", ovr: 86,
    attributes: { threePT: 86, MID: 84, FIN: 84, DNK: 78, HAN: 92, PAS: 94, PDEF: 94, STL: 83, IDEF: 52, BLK: 36, REB: 76, ATH: 88, STR: 84, CLU: 90 }
  },
  "D083": {
    pos: "SF", height: "6'7\"", profile: "point_forward", ovr: 76,
    attributes: { threePT: 68, MID: 76, FIN: 78, DNK: 82, HAN: 80, PAS: 78, PDEF: 82, STL: 72, IDEF: 70, BLK: 48, REB: 78, ATH: 86, STR: 80, CLU: 76 }
  },
  "D084": {
    pos: "SG", height: "6'3\"", profile: "perimeter_scorer", ovr: 87,
    attributes: { threePT: 84, MID: 94, FIN: 96, DNK: 88, HAN: 94, PAS: 86, PDEF: 86, STL: 74, IDEF: 44, BLK: 30, REB: 82, ATH: 92, STR: 90, CLU: 94 }
  },
  "D085": {
    pos: "C", height: "7'1\"", profile: "skilled_big", ovr: 81,
    attributes: { threePT: 84, MID: 84, FIN: 86, DNK: 82, HAN: 68, PAS: 76, PDEF: 70, STL: 61, IDEF: 84, BLK: 86, REB: 84, ATH: 68, STR: 82, CLU: 82 }
  },
  "D086": {
    pos: "C", height: "6'10\"", profile: "skilled_big", ovr: 84,
    attributes: { threePT: 78, MID: 88, FIN: 96, DNK: 86, HAN: 76, PAS: 82, PDEF: 70, STL: 62, IDEF: 84, BLK: 76, REB: 86, ATH: 72, STR: 88, CLU: 90 }
  },
  "D087": {
    pos: "C", height: "7'0\"", profile: "rim_protector", ovr: 83,
    attributes: { threePT: 76, MID: 82, FIN: 88, DNK: 82, HAN: 68, PAS: 76, PDEF: 72, STL: 63, IDEF: 86, BLK: 86, REB: 90, ATH: 76, STR: 88, CLU: 84 }
  },
  "D088": {
    pos: "C", height: "6'11\"", profile: "rim_protector", ovr: 84,
    attributes: { threePT: 38, MID: 50, FIN: 94, DNK: 94, HAN: 54, PAS: 62, PDEF: 72, STL: 63, IDEF: 92, BLK: 96, REB: 88, ATH: 90, STR: 96, CLU: 82 }
  },
  "D089": {
    pos: "PG", height: "6'1\"", profile: "playmaker", ovr: 85,
    attributes: { threePT: 88, MID: 86, FIN: 86, DNK: 72, HAN: 94, PAS: 96, PDEF: 88, STL: 79, IDEF: 38, BLK: 28, REB: 66, ATH: 90, STR: 72, CLU: 96 }
  },
  "D090": {
    pos: "SG", height: "6'5\"", profile: "perimeter_scorer", ovr: 76,
    attributes: { threePT: 78, MID: 82, FIN: 80, DNK: 82, HAN: 82, PAS: 72, PDEF: 76, STL: 68, IDEF: 42, BLK: 30, REB: 64, ATH: 84, STR: 72, CLU: 80 }
  },
  "D091": {
    pos: "C", height: "6'9\"", profile: "rim_protector", ovr: 79,
    attributes: { threePT: 56, MID: 64, FIN: 84, DNK: 90, HAN: 60, PAS: 58, PDEF: 68, STL: 60, IDEF: 82, BLK: 84, REB: 84, ATH: 86, STR: 84, CLU: 76 }
  },
  "D092": {
    pos: "C", height: "6'10\"", profile: "rim_protector", ovr: 80,
    attributes: { threePT: 38, MID: 54, FIN: 88, DNK: 90, HAN: 58, PAS: 60, PDEF: 70, STL: 61, IDEF: 86, BLK: 90, REB: 90, ATH: 84, STR: 86, CLU: 78 }
  },
  "D093": {
    pos: "PG", height: "6'1\"", profile: "scoring_guard", ovr: 87,
    attributes: { threePT: 94, MID: 94, FIN: 94, DNK: 78, HAN: 94, PAS: 92, PDEF: 84, STL: 73, IDEF: 36, BLK: 26, REB: 70, ATH: 92, STR: 76, CLU: 96 }
  },
  "D094": {
    pos: "SG", height: "6'6\"", profile: "two_way_slasher", ovr: 75,
    attributes: { threePT: 68, MID: 72, FIN: 76, DNK: 86, HAN: 74, PAS: 68, PDEF: 84, STL: 73, IDEF: 60, BLK: 60, REB: 74, ATH: 88, STR: 84, CLU: 72 }
  },
  "D095": {
    pos: "PF", height: "6'9\"", profile: "interior_forward", ovr: 79,
    attributes: { threePT: 74, MID: 70, FIN: 86, DNK: 92, HAN: 70, PAS: 64, PDEF: 80, STL: 70, IDEF: 78, BLK: 72, REB: 80, ATH: 92, STR: 80, CLU: 76 }
  },
  "D096": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 81,
    attributes: { threePT: 82, MID: 78, FIN: 84, DNK: 88, HAN: 76, PAS: 70, PDEF: 84, STL: 74, IDEF: 76, BLK: 70, REB: 80, ATH: 90, STR: 82, CLU: 78 }
  },
  "D097": {
    pos: "SF", height: "6'8\"", profile: "two_way_wing", ovr: 78,
    attributes: { threePT: 88, MID: 74, FIN: 78, DNK: 84, HAN: 74, PAS: 72, PDEF: 82, STL: 72, IDEF: 74, BLK: 56, REB: 72, ATH: 88, STR: 78, CLU: 74 }
  },
  "D098": {
    pos: "PG", height: "6'1\"", profile: "scoring_guard", ovr: 85,
    attributes: { threePT: 88, MID: 90, FIN: 90, DNK: 82, HAN: 94, PAS: 90, PDEF: 82, STL: 75, IDEF: 36, BLK: 26, REB: 66, ATH: 94, STR: 72, CLU: 92 }
  },
  "D099": {
    pos: "PF", height: "6'8\"", profile: "interior_forward", ovr: 84,
    attributes: { threePT: 52, MID: 62, FIN: 90, DNK: 92, HAN: 66, PAS: 72, PDEF: 88, STL: 76, IDEF: 94, BLK: 94, REB: 88, ATH: 90, STR: 94, CLU: 90 }
  },
  "D100": {
    pos: "PF", height: "6'10\"", profile: "stretch_four", ovr: 75,
    attributes: { threePT: 84, MID: 80, FIN: 76, DNK: 78, HAN: 70, PAS: 68, PDEF: 72, STL: 65, IDEF: 74, BLK: 60, REB: 82, ATH: 72, STR: 78, CLU: 80 }
  }
};
