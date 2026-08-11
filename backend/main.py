# Variables store the trip data
# destination = "Japan"
# days = 5
# budget = 1500
# travel_style = "Family"

# Reuse them anywhere
# print(destination)
# print(days)

#############################################################################

# Helper: returns 0.0 if the user presses Enter without typing anything
def input_cost(prompt):
    value = input(prompt).strip()
    return float(value) if value else 0.0

# Ask the user for trip details
destination = input("Destination : ")
days = int(input("Days : "))
budget = float(input("Budget : "))
travel_style = input("Travel Style : ")
hotel_cost = input_cost("Hotel Cost : ")
transportation_cost = input_cost("Transportation Cost : ")
food_cost = input_cost("Food Cost : ")
miscellaneous_cost = input_cost("Misc. Cost : ")
total_estimated_cost = hotel_cost + transportation_cost + food_cost + miscellaneous_cost

#############################################################################
def print_trip_summary(destination, days, budget, travel_style, hotel_cost,
                       transportation_cost, food_cost, miscellaneous_cost, total_estimated_cost):
    print( "========================" )
    print( "KelanaAI" )
    print( "========================" )
    print( f"Destination : {destination}" )
    print( f"Days : {days}" )
    print( f"Budget : {budget} USD" )
    print( f"Travel Style : {travel_style}")
    print( f"Hotel Cost : {hotel_cost}")
    print( f"Transportation Cost : {transportation_cost}")
    print( f"Food Cost : {food_cost}")
    print( f"Miscellaneous Cost : {miscellaneous_cost}")

    if total_estimated_cost > budget:
        print(f"Total Cost : {total_estimated_cost} - ⚠ Budget exceeded.")
    else:
        print(f"Total Cost : {total_estimated_cost} - Budget Secured.")
    print( "========================" )

print_trip_summary(destination, days, budget, travel_style, hotel_cost, transportation_cost, food_cost, miscellaneous_cost,
total_estimated_cost)
