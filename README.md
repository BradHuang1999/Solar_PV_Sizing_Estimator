# Solar Panel and Battery Size Calculator

Solar Panel and Battery Size Calculator intended for homeowners and small to medium businesses to determine how many solar panels and how large a storage battery to buy to achieve a certain level of grid independence, based on users' location, solar panel parameters, monthly load profile, yearly electricity cost, as well as other estimation parameters.

The calculator uses linear regression (ARMA model) to estimate users' hourly electricity usage and a robust statistical algorithm to optimize the amount of solar panels and battery storage needed to fulfill a certain portion of your electricity needs with minimum cost.

### Previous Work

The two algorithms are based on the work of:

([Robust sizing model](https://github.com/iss4e/Robust_Sizing))
> F. Kazhamiaka, Y. Ghiassi-Farokhfal, S. Keshav, and C. Rosenberg, Comparison of Different Approaches for Solar PV and Storage Sizing, Proc. IEEE Transactions on Sustainable Computing, September 2019.

(ARMA model)
> S. Sun, F. Kazhamiaka, S. Keshav, and C. Rosenberg, Using Synthetic Traces for Robust Energy System Sizing, Proc. ACM eEnergy 2019, June 2019.

This work integrates [Robust PV and Storage Sizing Code](https://github.com/iss4e/Robust_Sizing) developed by the ISS4E Lab in the University of Waterloo and the [PVWatts API](https://developer.nrel.gov/docs/solar/pvwatts/v6/).

### Live Version

A live version of this calculator is hosted [here](http://blizzard.cs.uwaterloo.ca/pvcalculator/).
