/**
 * lib/yssy-gates.js
 * ----------------------------------------------------------------
 * Curated, chart-accurate parking-position coordinates for Sydney
 * Airport (YSSY), sourced directly from the Airservices Australia DAP
 * apron charts (SSYAP01/SSYAP03, 09 JUL 2026) rather than OpenStreetMap.
 *
 * YSSY's community-tagged OSM parking_position data proved unreliable
 * after repeated testing — several nodes sat in car parks and open
 * fields near the Qantas Freight Terminal, close enough to a tagged
 * apron/taxiway edge to survive even a tightened 40m proximity filter.
 * Rather than keep chasing threshold tweaks, this airport now bypasses
 * Overpass entirely and serves these hand-verified coordinates.
 *
 * Coordinates converted from DMS (e.g. "33 55 43.16S 151 10 05.74E")
 * to WGS84 decimal degrees. 145 stands total across the International
 * (T1), Domestic (T2), Domestic pier/remote (T3), and international
 * remote bays.
 */

const YSSY_GATES = [
  {
    "code": "1",
    "lat": -33.92865556,
    "lon": 151.16826111,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "2",
    "lat": -33.92986944,
    "lon": 151.16724722,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "3",
    "lat": -33.93050833,
    "lon": 151.16741389,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "4",
    "lat": -33.93114722,
    "lon": 151.16757778,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "5",
    "lat": -33.93178611,
    "lon": 151.16774722,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "6",
    "lat": -33.93246389,
    "lon": 151.16785278,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "8",
    "lat": -33.93407500,
    "lon": 151.16744444,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "9",
    "lat": -33.93485278,
    "lon": 151.16760556,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "10",
    "lat": -33.93576111,
    "lon": 151.16792778,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "11",
    "lat": -33.93417000,
    "lon": 151.16990833,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "12",
    "lat": -33.93390556,
    "lon": 151.16979722,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "24",
    "lat": -33.93649722,
    "lon": 151.16919722,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "25",
    "lat": -33.93638611,
    "lon": 151.17016389,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "30",
    "lat": -33.93759167,
    "lon": 151.16843333,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "31",
    "lat": -33.93738333,
    "lon": 151.16914167,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "32",
    "lat": -33.93822222,
    "lon": 151.16864722,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "33",
    "lat": -33.93802500,
    "lon": 151.16929167,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "34",
    "lat": -33.93885000,
    "lon": 151.16886111,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "35",
    "lat": -33.93868056,
    "lon": 151.16939167,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "36",
    "lat": -33.93947500,
    "lon": 151.16912778,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "37",
    "lat": -33.93930833,
    "lon": 151.16960833,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "50",
    "lat": -33.93856944,
    "lon": 151.16533889,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "51",
    "lat": -33.93832500,
    "lon": 151.16596667,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "53",
    "lat": -33.93895556,
    "lon": 151.16618056,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "54",
    "lat": -33.93953056,
    "lon": 151.16475556,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "55",
    "lat": -33.93935000,
    "lon": 151.16669722,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "56",
    "lat": -33.93965833,
    "lon": 151.16422222,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "57",
    "lat": -33.93961111,
    "lon": 151.16647778,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "58",
    "lat": -33.93990000,
    "lon": 151.16605000,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "59",
    "lat": -33.94003333,
    "lon": 151.16528056,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "60",
    "lat": -33.94022778,
    "lon": 151.16452222,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "61",
    "lat": -33.94041667,
    "lon": 151.16405833,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "63",
    "lat": -33.93995556,
    "lon": 151.16400556,
    "terminal": "T1",
    "pier": "International"
  },
  {
    "code": "1",
    "lat": -33.93195556,
    "lon": 151.18071389,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "2",
    "lat": -33.93187778,
    "lon": 151.18022500,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "3",
    "lat": -33.93180278,
    "lon": 151.17968056,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "4",
    "lat": -33.93176944,
    "lon": 151.17910278,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "5",
    "lat": -33.93165833,
    "lon": 151.17854444,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "6",
    "lat": -33.93160833,
    "lon": 151.17799444,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "7",
    "lat": -33.93138333,
    "lon": 151.17753333,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "7A",
    "lat": -33.93155556,
    "lon": 151.17747500,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "8",
    "lat": -33.93125000,
    "lon": 151.17711667,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "9",
    "lat": -33.93109722,
    "lon": 151.17671389,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "10",
    "lat": -33.93113333,
    "lon": 151.17630000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "11",
    "lat": -33.93167500,
    "lon": 151.17655000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "12",
    "lat": -33.93197778,
    "lon": 151.17650278,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "13",
    "lat": -33.93214444,
    "lon": 151.17675833,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "14",
    "lat": -33.93220278,
    "lon": 151.17686111,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "16",
    "lat": -33.93263611,
    "lon": 151.17694444,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "17",
    "lat": -33.93305278,
    "lon": 151.17708889,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "17A",
    "lat": -33.93310278,
    "lon": 151.17702222,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "17B",
    "lat": -33.93305000,
    "lon": 151.17670000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "18",
    "lat": -33.93322778,
    "lon": 151.17766944,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "18A",
    "lat": -33.93321944,
    "lon": 151.17743333,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "19",
    "lat": -33.93378889,
    "lon": 151.17746667,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "19A",
    "lat": -33.93352222,
    "lon": 151.17688056,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "19B",
    "lat": -33.93351944,
    "lon": 151.17665278,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "31",
    "lat": -33.93476389,
    "lon": 151.17934722,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "31A",
    "lat": -33.93481389,
    "lon": 151.17908056,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "31B",
    "lat": -33.93470278,
    "lon": 151.17893056,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "32",
    "lat": -33.93477222,
    "lon": 151.18015000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "32A",
    "lat": -33.93473611,
    "lon": 151.18036111,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "33",
    "lat": -33.93526111,
    "lon": 151.17933611,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "33A",
    "lat": -33.93528611,
    "lon": 151.17898056,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "33B",
    "lat": -33.93519444,
    "lon": 151.17885000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "34",
    "lat": -33.93507500,
    "lon": 151.17991944,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "34A",
    "lat": -33.93509167,
    "lon": 151.18012778,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "35",
    "lat": -33.93578333,
    "lon": 151.17915833,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "35A",
    "lat": -33.93572500,
    "lon": 151.17873889,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "36",
    "lat": -33.93554167,
    "lon": 151.17980278,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "38",
    "lat": -33.93595556,
    "lon": 151.17968056,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "39",
    "lat": -33.93628056,
    "lon": 151.17910000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "39A",
    "lat": -33.93620000,
    "lon": 151.17881111,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "39B",
    "lat": -33.93621944,
    "lon": 151.17860556,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "40",
    "lat": -33.93635278,
    "lon": 151.17968333,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "41",
    "lat": -33.93661667,
    "lon": 151.17895278,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "42",
    "lat": -33.93674722,
    "lon": 151.17970000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "43",
    "lat": -33.93700278,
    "lon": 151.17885000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "44",
    "lat": -33.93678611,
    "lon": 151.17970556,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "44A",
    "lat": -33.93695000,
    "lon": 151.17964444,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "45",
    "lat": -33.93714722,
    "lon": 151.17924722,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "45A",
    "lat": -33.93717778,
    "lon": 151.17925833,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "49",
    "lat": -33.93413611,
    "lon": 151.17725000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "49B",
    "lat": -33.93406111,
    "lon": 151.17673611,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "52",
    "lat": -33.93478611,
    "lon": 151.17760556,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "52A",
    "lat": -33.93479167,
    "lon": 151.17783056,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "52B",
    "lat": -33.93490000,
    "lon": 151.17801389,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "53",
    "lat": -33.93464722,
    "lon": 151.17714444,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "53B",
    "lat": -33.93456111,
    "lon": 151.17662778,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "54",
    "lat": -33.93523056,
    "lon": 151.17752500,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "54A",
    "lat": -33.93525278,
    "lon": 151.17777500,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "55",
    "lat": -33.93516111,
    "lon": 151.17705833,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "55B",
    "lat": -33.93508889,
    "lon": 151.17655000,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "56",
    "lat": -33.93594167,
    "lon": 151.17740556,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "57",
    "lat": -33.93561389,
    "lon": 151.17698611,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "57A",
    "lat": -33.93559167,
    "lon": 151.17680556,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "57B",
    "lat": -33.93547500,
    "lon": 151.17662500,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "58",
    "lat": -33.93593333,
    "lon": 151.17713611,
    "terminal": "T2",
    "pier": "Domestic"
  },
  {
    "code": "90",
    "lat": -33.93521389,
    "lon": 151.18496111,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "90A",
    "lat": -33.93509444,
    "lon": 151.18499722,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "90B",
    "lat": -33.93533889,
    "lon": 151.18480278,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "90C",
    "lat": -33.93526111,
    "lon": 151.18493889,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "91",
    "lat": -33.93526944,
    "lon": 151.18534722,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "91A",
    "lat": -33.93515556,
    "lon": 151.18542778,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "91B",
    "lat": -33.93544444,
    "lon": 151.18539444,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "92",
    "lat": -33.93552500,
    "lon": 151.18582778,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "92A",
    "lat": -33.93532083,
    "lon": 151.18578611,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "92B",
    "lat": -33.93568889,
    "lon": 151.18580278,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "93",
    "lat": -33.93525000,
    "lon": 151.18613333,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "93A",
    "lat": -33.93513611,
    "lon": 151.18660556,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "93B",
    "lat": -33.93541389,
    "lon": 151.18615278,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "93C",
    "lat": -33.93554167,
    "lon": 151.18618611,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "94",
    "lat": -33.93535556,
    "lon": 151.18661389,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "94B",
    "lat": -33.93552500,
    "lon": 151.18663611,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "96",
    "lat": -33.93516111,
    "lon": 151.18783333,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "96A",
    "lat": -33.93520000,
    "lon": 151.18785556,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "96B",
    "lat": -33.93525278,
    "lon": 151.18791667,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "96C",
    "lat": -33.93487778,
    "lon": 151.18809444,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "97",
    "lat": -33.93547222,
    "lon": 151.18960556,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "97A",
    "lat": -33.93510556,
    "lon": 151.18959167,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "97B",
    "lat": -33.93512222,
    "lon": 151.18910833,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "97C",
    "lat": -33.93518056,
    "lon": 151.18980556,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "98",
    "lat": -33.93529444,
    "lon": 151.19035556,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "98A",
    "lat": -33.93492222,
    "lon": 151.19036944,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "98B",
    "lat": -33.93507222,
    "lon": 151.19011667,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "99",
    "lat": -33.93509444,
    "lon": 151.19110278,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "99A",
    "lat": -33.93475833,
    "lon": 151.19106111,
    "terminal": "T3",
    "pier": "Domestic"
  },
  {
    "code": "71",
    "lat": -33.94422222,
    "lon": 151.17229167,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "72",
    "lat": -33.94438889,
    "lon": 151.17143333,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "73",
    "lat": -33.94537778,
    "lon": 151.17080556,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "73A",
    "lat": -33.94479722,
    "lon": 151.17059167,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "74",
    "lat": -33.94560833,
    "lon": 151.16987778,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "74A",
    "lat": -33.94503056,
    "lon": 151.16960000,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "75",
    "lat": -33.94578611,
    "lon": 151.16912500,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "75A",
    "lat": -33.94524444,
    "lon": 151.16869167,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "76",
    "lat": -33.94596111,
    "lon": 151.16837778,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "77",
    "lat": -33.94613056,
    "lon": 151.16761389,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "77A",
    "lat": -33.94556389,
    "lon": 151.16733611,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "83",
    "lat": -33.92698333,
    "lon": 151.17486111,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "83A",
    "lat": -33.92691944,
    "lon": 151.17475000,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "83B",
    "lat": -33.92730278,
    "lon": 151.17469444,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "84",
    "lat": -33.92761944,
    "lon": 151.17503611,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "85",
    "lat": -33.92826111,
    "lon": 151.17519444,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "85A",
    "lat": -33.92805000,
    "lon": 151.17487778,
    "terminal": "INTL_REMOTE",
    "pier": ""
  },
  {
    "code": "85B",
    "lat": -33.92840556,
    "lon": 151.17514722,
    "terminal": "INTL_REMOTE",
    "pier": ""
  }
];

module.exports = { YSSY_GATES };
