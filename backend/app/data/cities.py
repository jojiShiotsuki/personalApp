"""Predefined city lists for the Search Planner."""

CITIES_BY_COUNTRY: dict[str, list[str]] = {
    "Australia": [
        # Capital cities
        "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide",
        "Hobart", "Darwin", "Canberra",
        # NSW regional
        "Newcastle", "Wollongong", "Central Coast", "Penrith",
        "Parramatta", "Blacktown", "Campbelltown", "Liverpool",
        "Sutherland", "Northern Beaches", "Maitland", "Wagga Wagga",
        "Albury", "Port Macquarie", "Tamworth", "Orange",
        "Dubbo", "Bathurst", "Lismore", "Coffs Harbour",
        "Tweed Heads", "Nowra",
        # VIC regional
        "Geelong", "Ballarat", "Bendigo", "Shepparton", "Mildura",
        "Wodonga", "Warrnambool", "Traralgon",
        # QLD regional
        "Gold Coast", "Sunshine Coast", "Townsville", "Cairns",
        "Toowoomba", "Mackay", "Rockhampton", "Bundaberg",
        "Hervey Bay", "Gladstone", "Ipswich", "Logan",
        "Redland City", "Moreton Bay",
        # WA regional
        "Mandurah", "Bunbury", "Geraldton", "Kalgoorlie",
        "Rockingham", "Joondalup", "Fremantle",
        # SA regional
        "Mount Gambier", "Murray Bridge", "Port Augusta",
        "Port Lincoln", "Whyalla",
        # TAS regional
        "Launceston", "Devonport", "Burnie",
        # NT
        "Alice Springs", "Katherine",
        # ACT
        "Queanbeyan",
    ],
    "United States": [
        "New York", "Los Angeles", "Chicago", "Houston", "Phoenix",
        "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose",
        "Austin", "Jacksonville", "Fort Worth", "Columbus", "Charlotte",
        "Indianapolis", "San Francisco", "Seattle", "Denver", "Washington DC",
        "Nashville", "Oklahoma City", "El Paso", "Boston", "Portland",
        "Las Vegas", "Memphis", "Louisville", "Baltimore", "Milwaukee",
        "Albuquerque", "Tucson", "Fresno", "Sacramento", "Mesa",
        "Kansas City", "Atlanta", "Omaha", "Colorado Springs",
        "Raleigh", "Long Beach", "Virginia Beach", "Miami",
        "Oakland", "Minneapolis", "Tampa", "Tulsa", "Arlington",
        "New Orleans", "Cleveland", "Honolulu", "Orlando", "Pittsburgh",
        "St. Louis", "Cincinnati", "Salt Lake City",
        "Detroit", "Boise", "Richmond",
    ],
    "United Kingdom": [
        "London", "Birmingham", "Manchester", "Leeds", "Glasgow",
        "Liverpool", "Newcastle", "Sheffield", "Bristol", "Edinburgh",
        "Cardiff", "Belfast", "Leicester", "Nottingham", "Southampton",
        "Plymouth", "Brighton", "Bournemouth", "Reading", "Coventry",
        "Swansea", "Wolverhampton", "Derby", "Stoke-on-Trent",
        "Aberdeen", "Dundee", "Oxford", "Cambridge", "York",
        "Norwich", "Exeter", "Bath", "Canterbury", "Ipswich",
        "Milton Keynes", "Northampton", "Swindon", "Peterborough",
        "Luton", "Sunderland",
    ],
    "New Zealand": [
        "Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga",
        "Napier-Hastings", "Dunedin", "Palmerston North", "Nelson",
        "Rotorua", "New Plymouth", "Whangarei", "Invercargill",
        "Whanganui", "Gisborne", "Blenheim", "Queenstown",
        "Timaru", "Pukekohe", "Kapiti Coast",
    ],
    "Canada": [
        "Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton",
        "Ottawa", "Winnipeg", "Quebec City", "Hamilton", "Kitchener",
        "London", "Victoria", "Halifax", "Oshawa", "Windsor",
        "Saskatoon", "Regina", "St. John's", "Kelowna",
        "Barrie", "Sherbrooke", "Guelph", "Abbotsford",
        "Kingston", "Trois-Rivieres", "Moncton", "Nanaimo",
        "Sudbury", "Thunder Bay", "Red Deer",
    ],
}


def get_countries() -> list[str]:
    return sorted(CITIES_BY_COUNTRY.keys())


def get_cities(country: str) -> list[str]:
    return CITIES_BY_COUNTRY.get(country, [])
