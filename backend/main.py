def input_required(prompt):
    """Prompt until the user enters a non-empty value."""
    while True:
        value = input(prompt).strip()
        if value:
            return value
        print("  This field is required. Please enter a value.")


def input_positive_number(prompt):
    """Prompt until the user enters a valid positive number."""
    while True:
        value = input(prompt).strip()
        if not value:
            print("  This field is required. Please enter a number.")
            continue
        try:
            number = float(value)
            if number < 0:
                print("  Please enter a non-negative number.")
                continue
            return number
        except ValueError:
            print("  Invalid input. Please enter a numeric value.")


def input_positive_int(prompt):
    """Prompt until the user enters a valid positive integer."""
    while True:
        value = input(prompt).strip()
        if not value:
            print("  This field is required. Please enter a number.")
            continue
        try:
            number = int(value)
            if number <= 0:
                print("  Please enter a number greater than 0.")
                continue
            return number
        except ValueError:
            print("  Invalid input. Please enter a whole number.")


def input_cost(prompt):
    """Prompt for an optional cost. Returns 0.0 if left empty."""
    while True:
        value = input(prompt).strip()
        if not value:
            return 0.0
        try:
            number = float(value)
            if number < 0:
                print("  Please enter a non-negative number.")
                continue
            return number
        except ValueError:
            print("  Invalid input. Please enter a numeric value or leave empty.")


def collect_trip_details():
    """Ask the user for all trip details and return them as a dict."""
    print("========================")
    print("        KelanaAI        ")
    print("========================")
    print("Enter your trip details:\n")

    trip = {
        "destination":          input_required("Destination : "),
        "country":              input_required("Country : "),
        "travel_month":         input_required("Travel Month : "),
        "days":                 input_positive_int("Number of Days : "),
        "budget":               input_positive_number("Total Budget : "),
        "currency":             input_required("Currency : "),
        "travel_style":         input_required("Travel Style : "),
        "hotel_cost":           input_cost("Hotel Cost : "),
        "transportation_cost":  input_cost("Transportation : "),
        "food_cost":            input_cost("Food Cost : "),
        "miscellaneous_cost":   input_cost("Misc. Cost : "),
    }

    trip["total_estimated_cost"] = (
        trip["hotel_cost"]
        + trip["transportation_cost"]
        + trip["food_cost"]
        + trip["miscellaneous_cost"]
    )
    trip["remaining_budget"] = trip["budget"] - trip["total_estimated_cost"]

    return trip


def print_trip_summary(trip):
    """Print a formatted summary of the trip."""
    cur = trip["currency"]

    print("\n========================")
    print("      Trip Summary      ")
    print("========================")
    print(f"  Destination      : {trip['destination']}, {trip['country']}")
    print(f"  Travel Month     : {trip['travel_month']}")
    print(f"  Duration         : {trip['days']} day(s)")
    print(f"  Travel Style     : {trip['travel_style']}")
    print(f"  Currency         : {cur}")
    print("------------------------")
    print(f"  Hotel Cost       : {trip['hotel_cost']:>10.2f} {cur}")
    print(f"  Transportation   : {trip['transportation_cost']:>10.2f} {cur}")
    print(f"  Food Cost        : {trip['food_cost']:>10.2f} {cur}")
    print(f"  Misc. Cost       : {trip['miscellaneous_cost']:>10.2f} {cur}")
    print("------------------------")
    print(f"  Total Cost       : {trip['total_estimated_cost']:>10.2f} {cur}")
    print(f"  Budget           : {trip['budget']:>10.2f} {cur}")
    print("------------------------")

    if trip["total_estimated_cost"] > trip["budget"]:
        print(f"  ⚠  Over Budget by : {abs(trip['remaining_budget']):>10.2f} {cur}")
    else:
        print(f"  ✔  Remaining       : {trip['remaining_budget']:>10.2f} {cur}")

    print("========================\n")


# --- Main ---
trip = collect_trip_details()
print_trip_summary(trip)
