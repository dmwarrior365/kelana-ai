# ─── 1. CONDITIONALS ────────────────────────
def get_trip_category(budget):
    if budget < 1000:
        return "Backpacker"
    elif budget <= 3000:
        return "Standard"
    else:
        return "Luxury"

def get_travel_season(month):
    # Map month numbers to names so both "12" and "December" work
    month_map = {
        "1": "January", "2": "February", "3": "March",
        "4": "April",   "5": "May",      "6": "June",
        "7": "July",    "8": "August",   "9": "September",
        "10": "October","11": "November","12": "December"
    }

    # Normalise: strip whitespace, convert number strings to month names
    normalised = str(month).strip()
    normalised = month_map.get(normalised, normalised).capitalize()

    if normalised == "December":
        return "Peak Season"
    elif normalised == "June":
        return "Holiday Season"
    else:
        return "Regular Season"

def get_transport_category(budget):
    category = get_trip_category(budget)

    if category == "Backpacker":
        return "Bus / Train"
    elif category == "Standard":
        return "Economy Flight"
    else:
        return "Business Flight / Private Transfer"

# ─── 2. REUSABLE FUNCTIONS ────────────────────────
def calculate_daily_budget(budget, days):
    return budget / days

# ─── TESTS ────────────────────────────────────
if __name__ == "__main__":
    # get_travel_season
    assert get_travel_season("December")  == "Peak Season"
    assert get_travel_season("december")  == "Peak Season"
    assert get_travel_season("12")        == "Peak Season"
    assert get_travel_season("June")      == "Holiday Season"
    assert get_travel_season("june")      == "Holiday Season"
    assert get_travel_season("6")         == "Holiday Season"
    assert get_travel_season("March")     == "Regular Season"
    assert get_travel_season("3")         == "Regular Season"

    # get_trip_category
    assert get_trip_category(500)         == "Backpacker"
    assert get_trip_category(1000)        == "Standard"
    assert get_trip_category(3000)        == "Standard"
    assert get_trip_category(5000)        == "Luxury"

    # get_transport_category
    assert get_transport_category(500)    == "Bus / Train"
    assert get_transport_category(2000)   == "Economy Flight"
    assert get_transport_category(5000)   == "Business Flight / Private Transfer"

    # calculate_daily_budget
    assert calculate_daily_budget(1000, 5) == 200.0

    print("All tests passed.")
