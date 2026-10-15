// Airline Reservation System - Booking Engine
class BookingEngine {
  constructor() {
    this.searchParams = {
      tripType: "oneway",
      origin: "JFK",
      destination: "LHR",
      departureDate: "",
      returnDate: "",
      cabinClass: "economy",
      adults: 1,
      children: 0,
      infants: 0
    };

    this.selectedOutboundFlight = null;
    this.selectedFareClass = "economy";
    this.passengerData = [];
    this.selectedSeats = {};
    this.seatFees = 0;
    this.addons = {
      insurance: false,
      priority: false
    };

    this.activeFilters = {
      stops: "all",
      airlines: [],
      maxPrice: 1500,
      departureTime: "all",
      sortBy: "cheapest"
    };

    this.init();
  }

  init() {
    this.setDefaultDates();
    this.populateAirportDropdowns();
    this.setupEventListeners();
  }

  setDefaultDates() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const minDateStr = today.toISOString().split("T")[0];
    const depDateStr = tomorrow.toISOString().split("T")[0];
    const retDateStr = nextWeek.toISOString().split("T")[0];

    this.searchParams.departureDate = depDateStr;
    this.searchParams.returnDate = retDateStr;

    const depInput = document.getElementById("search-dep-date");
    const retInput = document.getElementById("search-ret-date");

    if (depInput) {
      depInput.min = minDateStr;
      depInput.value = depDateStr;
    }
    if (retInput) {
      retInput.min = depDateStr;
      retInput.value = retDateStr;
    }
  }

  populateAirportDropdowns() {
    const originSelect = document.getElementById("search-origin");
    const destSelect = document.getElementById("search-dest");
    if (!originSelect || !destSelect) return;

    const airports = window.AIRLINE_DATA.airports;

    let originOptions = "";
    let destOptions = "";

    airports.forEach(a => {
      originOptions += `<option value="${a.code}" ${a.code === "JFK" ? "selected" : ""}>
        ${a.flag} ${a.city} (${a.code}) - ${a.name}
      </option>`;
      destOptions += `<option value="${a.code}" ${a.code === "LHR" ? "selected" : ""}>
        ${a.flag} ${a.city} (${a.code}) - ${a.name}
      </option>`;
    });

    originSelect.innerHTML = originOptions;
    destSelect.innerHTML = destOptions;
  }

  setupEventListeners() {
    // Trip type toggles
    const tripTypeRadios = document.querySelectorAll('input[name="trip-type"]');
    tripTypeRadios.forEach(radio => {
      radio.addEventListener("change", (e) => {
        this.searchParams.tripType = e.target.value;
        const retGroup = document.getElementById("return-date-group");
        if (retGroup) {
          retGroup.style.display = e.target.value === "roundtrip" ? "block" : "none";
        }
      });
    });

    // Swap button
    const swapBtn = document.getElementById("btn-swap-airports");
    if (swapBtn) {
      swapBtn.addEventListener("click", () => {
        const originSelect = document.getElementById("search-origin");
        const destSelect = document.getElementById("search-dest");
        if (originSelect && destSelect) {
          const temp = originSelect.value;
          originSelect.value = destSelect.value;
          destSelect.value = temp;
        }
      });
    }

    // Departure date change syncs min return date
    const depInput = document.getElementById("search-dep-date");
    const retInput = document.getElementById("search-ret-date");
    if (depInput && retInput) {
      depInput.addEventListener("change", () => {
        retInput.min = depInput.value;
        if (retInput.value < depInput.value) {
          retInput.value = depInput.value;
        }
      });
    }

    // Search form submission
    const searchForm = document.getElementById("flight-search-form");
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.executeSearch();
      });
    }

    // Card formatting helpers
    const cardInput = document.getElementById("card-number");
    if (cardInput) {
      cardInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "").substring(0, 16);
        val = val.replace(/(\d{4})/g, "$1 ").trim();
        e.target.value = val;
      });
    }

    const expInput = document.getElementById("card-exp");
    if (expInput) {
      expInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "").substring(0, 4);
        if (val.length >= 2) {
          val = val.substring(0, 2) + "/" + val.substring(2);
        }
        e.target.value = val;
      });
    }
  }

  getTotalPassengerCount() {
    return parseInt(this.searchParams.adults || 1) + 
           parseInt(this.searchParams.children || 0) + 
           parseInt(this.searchParams.infants || 0);
  }

  executeSearch() {
    const originSelect = document.getElementById("search-origin");
    const destSelect = document.getElementById("search-dest");
    const depDate = document.getElementById("search-dep-date");
    const retDate = document.getElementById("search-ret-date");
    const cabin = document.getElementById("search-cabin");
    const adults = document.getElementById("search-adults");
    const children = document.getElementById("search-children");

    if (originSelect.value === destSelect.value) {
      alert("Origin and destination cannot be the same airport.");
      return;
    }

    this.searchParams.origin = originSelect.value;
    this.searchParams.destination = destSelect.value;
    this.searchParams.departureDate = depDate.value;
    this.searchParams.returnDate = retDate ? retDate.value : "";
    this.searchParams.cabinClass = cabin.value;
    this.searchParams.adults = parseInt(adults.value || 1);
    this.searchParams.children = parseInt(children ? children.value : 0);

    // Switch to results section
    this.showStep("results-step");
    this.renderSearchResults();
  }

  getFilteredFlights() {
    const allFlights = window.AirlineStorage.getFlights();
    const { origin, destination } = this.searchParams;

    // Filter by route
    let matching = allFlights.filter(f => f.origin === origin && f.destination === destination);

    // If no direct route in demo dataset, fall back to connecting flights or simulated flights
    if (matching.length === 0) {
      matching = [
        {
          id: `FL-SYN-1`,
          flightNumber: "AG-" + Math.floor(100 + Math.random() * 899),
          airline: "AG",
          origin,
          destination,
          departureTime: "07:45",
          arrivalTime: "16:20",
          duration: "8h 35m",
          stops: 0,
          aircraft: "B789",
          basePrice: 520,
          status: "On Time",
          terminal: "T2",
          gate: "B14"
        },
        {
          id: `FL-SYN-2`,
          flightNumber: "SW-" + Math.floor(100 + Math.random() * 899),
          airline: "SW",
          origin,
          destination,
          departureTime: "14:15",
          arrivalTime: "23:50",
          duration: "9h 35m",
          stops: 1,
          stopDetails: "1h 20m layover",
          aircraft: "A350",
          basePrice: 430,
          status: "On Time",
          terminal: "T3",
          gate: "A08"
        }
      ];
    }

    // Apply sidebar filters
    return matching.filter(f => {
      // Stops
      if (this.activeFilters.stops === "direct" && f.stops !== 0) return false;
      if (this.activeFilters.stops === "1stop" && f.stops !== 1) return false;

      // Airlines
      if (this.activeFilters.airlines.length > 0 && !this.activeFilters.airlines.includes(f.airline)) {
        return false;
      }

      // Max price
      const multiplier = this.getCabinMultiplier();
      const currentPrice = Math.round(f.basePrice * multiplier);
      if (currentPrice > this.activeFilters.maxPrice) return false;

      // Departure time
      if (this.activeFilters.departureTime !== "all") {
        const hour = parseInt(f.departureTime.split(":")[0]);
        if (this.activeFilters.departureTime === "morning" && (hour < 5 || hour >= 12)) return false;
        if (this.activeFilters.departureTime === "afternoon" && (hour < 12 || hour >= 18)) return false;
        if (this.activeFilters.departureTime === "evening" && (hour < 18 && hour >= 5)) return false;
      }

      return true;
    }).sort((a, b) => {
      const priceA = a.basePrice * this.getCabinMultiplier();
      const priceB = b.basePrice * this.getCabinMultiplier();
      if (this.activeFilters.sortBy === "cheapest") return priceA - priceB;
      if (this.activeFilters.sortBy === "earliest") return a.departureTime.localeCompare(b.departureTime);
      return 0;
    });
  }

  getCabinMultiplier() {
    const fare = window.AIRLINE_DATA.fareClasses.find(c => c.code === this.searchParams.cabinClass);
    return fare ? fare.multiplier : 1.0;
  }

  renderSearchResults() {
    const listEl = document.getElementById("flight-results-list");
    const summaryHeader = document.getElementById("results-route-summary");
    if (!listEl) return;

    const flights = this.getFilteredFlights();
    const originAirport = window.AIRLINE_DATA.airports.find(a => a.code === this.searchParams.origin);
    const destAirport = window.AIRLINE_DATA.airports.find(a => a.code === this.searchParams.destination);

    if (summaryHeader) {
      summaryHeader.innerHTML = `
        <div class="route-title">
          <h3>${originAirport?.city} (${this.searchParams.origin}) ➔ ${destAirport?.city} (${this.searchParams.destination})</h3>
          <span class="route-date">📅 ${this.searchParams.departureDate} | 👤 ${this.getTotalPassengerCount()} Passenger(s) | 💺 ${this.searchParams.cabinClass.toUpperCase()}</span>
        </div>
        <div class="results-count">${flights.length} flights found</div>
      `;
    }

    if (flights.length === 0) {
      listEl.innerHTML = `
        <div class="no-results-card">
          <div class="no-results-icon">✈️</div>
          <h3>No flights match your filters</h3>
          <p>Try broadening your filter criteria or adjusting price range.</p>
          <button class="btn btn-secondary" onclick="window.Booking.resetFilters()">Reset Filters</button>
        </div>
      `;
      return;
    }

    let html = "";
    flights.forEach(flight => {
      const airline = window.AIRLINE_DATA.airlines[flight.airline] || { name: "Airline", color: "#333", logoText: "✈️" };
      const aircraft = window.AIRLINE_DATA.aircrafts[flight.aircraft] || { model: "Aircraft" };
      const baseFare = Math.round(flight.basePrice * this.getCabinMultiplier());
      const totalEstimated = baseFare * this.getTotalPassengerCount();

      html += `
        <div class="flight-card" data-flight-id="${flight.id}">
          <div class="flight-card-main">
            <!-- Airline details -->
            <div class="airline-column">
              <div class="airline-logo" style="background-color: ${airline.color}">${airline.logoText}</div>
              <div class="airline-meta">
                <span class="airline-name">${airline.name}</span>
                <span class="flight-no">${flight.flightNumber} • ${aircraft.model}</span>
              </div>
            </div>

            <!-- Schedule & Route timeline -->
            <div class="schedule-column">
              <div class="time-block origin-block">
                <span class="flight-time">${flight.departureTime}</span>
                <span class="airport-code">${flight.origin}</span>
                <span class="airport-terminal">${flight.terminal || "T1"}</span>
              </div>

              <div class="duration-block">
                <span class="flight-duration">${flight.duration}</span>
                <div class="flight-path-visual">
                  <span class="path-dot start"></span>
                  <span class="path-line ${flight.stops > 0 ? "has-stop" : ""}"></span>
                  <span class="path-plane">✈️</span>
                  <span class="path-dot end"></span>
                </div>
                <span class="stop-badge ${flight.stops === 0 ? "nonstop" : "has-stop"}">
                  ${flight.stops === 0 ? "Non-stop" : `${flight.stops} Stop (${flight.stopDetails || "Layover"})`}
                </span>
              </div>

              <div class="time-block dest-block">
                <span class="flight-time">${flight.arrivalTime}</span>
                <span class="airport-code">${flight.destination}</span>
                <span class="airport-terminal">${flight.destination === "LHR" ? "T3" : "T2"}</span>
              </div>
            </div>

            <!-- Pricing & Action -->
            <div class="pricing-column">
              <div class="price-box">
                <span class="price-from">From</span>
                <span class="price-amount">$${baseFare}</span>
                <span class="price-pax">per passenger</span>
              </div>
              <button class="btn btn-primary btn-select-flight" onclick="window.Booking.selectFlight('${flight.id}')">
                Select Flight
              </button>
            </div>
          </div>

          <!-- Fare Class Options Expandable Drawer -->
          <div class="fare-options-drawer" id="fare-drawer-${flight.id}" style="display: none;">
            <h4>Choose your fare category for ${flight.flightNumber}</h4>
            <div class="fare-cards-grid">
      `;

      window.AIRLINE_DATA.fareClasses.forEach(fc => {
        const farePrice = Math.round(flight.basePrice * fc.multiplier);
        const isSelected = fc.code === this.searchParams.cabinClass;

        html += `
          <div class="fare-tier-card ${isSelected ? "recommended" : ""}">
            ${isSelected ? '<span class="fare-badge">Selected Class</span>' : ""}
            <h5>${fc.name}</h5>
            <div class="tier-price">$${farePrice}</div>
            <ul class="tier-features">
              <li>🧳 Carry-on: ${fc.carryOn}</li>
              <li>🧳 Checked: ${fc.checkedBag}</li>
              <li>💺 ${fc.seatSelection}</li>
              <li>🔄 ${fc.changePolicy}</li>
            </ul>
            <button class="btn btn-sm ${isSelected ? "btn-primary" : "btn-secondary"}" 
                    onclick="window.Booking.proceedWithFare('${flight.id}', '${fc.code}')">
              Select ${fc.name}
            </button>
          </div>
        `;
      });

      html += `
            </div>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  selectFlight(flightId) {
    const drawer = document.getElementById(`fare-drawer-${flightId}`);
    if (drawer) {
      const isVisible = drawer.style.display === "block";
      document.querySelectorAll(".fare-options-drawer").forEach(d => d.style.display = "none");
      drawer.style.display = isVisible ? "none" : "block";
    }
  }

  proceedWithFare(flightId, cabinCode) {
    const flight = window.AirlineStorage.getFlightById(flightId) || this.getFilteredFlights().find(f => f.id === flightId);
    if (!flight) return;

    this.selectedOutboundFlight = flight;
    this.selectedFareClass = cabinCode;
    this.searchParams.cabinClass = cabinCode;

    this.initPassengerForm();
    this.showStep("passengers-step");
  }

  initPassengerForm() {
    const count = this.getTotalPassengerCount();
    const container = document.getElementById("passenger-cards-container");
    if (!container) return;

    let html = "";
    for (let i = 0; i < count; i++) {
      const isAdult = i < this.searchParams.adults;
      const typeLabel = isAdult ? "Adult" : (i < this.searchParams.adults + this.searchParams.children ? "Child" : "Infant");

      html += `
        <div class="passenger-card" data-pax-index="${i}">
          <div class="pax-card-header">
            <h4>Passenger ${i + 1} (${typeLabel})</h4>
            <span class="pax-seat-indicator" id="pax-seat-label-${i}">Seat: Not Selected</span>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label>Title *</label>
              <select class="input-field pax-title" required>
                <option value="Mr">Mr</option>
                <option value="Ms">Ms</option>
                <option value="Mrs">Mrs</option>
                <option value="Dr">Dr</option>
              </select>
            </div>
            <div class="form-group">
              <label>First / Given Name *</label>
              <input type="text" class="input-field pax-first-name" placeholder="e.g. John" required value="${i === 0 ? "John" : ""}">
            </div>
            <div class="form-group">
              <label>Last / Surname *</label>
              <input type="text" class="input-field pax-last-name" placeholder="e.g. Smith" required value="${i === 0 ? "Smith" : ""}">
            </div>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label>Date of Birth *</label>
              <input type="date" class="input-field pax-dob" required value="${isAdult ? "1990-01-01" : "2015-05-10"}">
            </div>
            <div class="form-group">
              <label>Passport / National ID *</label>
              <input type="text" class="input-field pax-passport" placeholder="e.g. P12345678" required value="${i === 0 ? "P98765432" : ""}">
            </div>
            <div class="form-group">
              <label>Nationality *</label>
              <select class="input-field pax-nationality">
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="India">India</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Singapore">Singapore</option>
                <option value="Australia">Australia</option>
                <option value="Japan">Japan</option>
              </select>
            </div>
          </div>

          <!-- Ancillaries per passenger -->
          <div class="ancillaries-grid">
            <div class="form-group">
              <label>Meal Preference</label>
              <select class="input-field pax-meal">
                ${window.AIRLINE_DATA.ancillaries.meals.map(m => `
                  <option value="${m.id}">${m.name} ${m.price > 0 ? `(+$${m.price})` : "(Included)"}</option>
                `).join("")}
              </select>
            </div>

            <div class="form-group">
              <label>Baggage Allowance</label>
              <select class="input-field pax-baggage">
                ${window.AIRLINE_DATA.ancillaries.baggage.map(b => `
                  <option value="${b.id}">${b.name} ${b.price > 0 ? `(+$${b.price})` : ""}</option>
                `).join("")}
              </select>
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    container.querySelectorAll(".pax-baggage, .pax-meal").forEach(el => {
      el.addEventListener("change", () => this.updatePriceBreakdown());
    });

    this.updatePriceBreakdown();
  }

  collectPassengerData() {
    const cards = document.querySelectorAll("#passenger-cards-container .passenger-card");
    const passengers = [];

    cards.forEach((card, idx) => {
      const title = card.querySelector(".pax-title")?.value || "Mr";
      const firstName = card.querySelector(".pax-first-name")?.value.trim() || "";
      const lastName = card.querySelector(".pax-last-name")?.value.trim() || "";
      const dob = card.querySelector(".pax-dob")?.value || "";
      const passport = card.querySelector(".pax-passport")?.value.trim() || "";
      const nationality = card.querySelector(".pax-nationality")?.value || "United States";
      const meal = card.querySelector(".pax-meal")?.value || "meal-std";
      const baggage = card.querySelector(".pax-baggage")?.value || "bag-std";
      const seat = this.selectedSeats[idx] || null;

      passengers.push({
        title,
        firstName,
        lastName,
        dob,
        passport,
        nationality,
        meal,
        baggage,
        seat
      });
    });

    return passengers;
  }

  openSeatMapModal() {
    const passengers = this.collectPassengerData();
    if (passengers.some(p => !p.firstName || !p.lastName)) {
      alert("Please enter passenger names before selecting seats.");
      return;
    }

    const modal = document.getElementById("seat-map-modal");
    if (modal) {
      modal.classList.add("open");
      window.SeatMap.init(
        this.selectedOutboundFlight,
        this.searchParams.departureDate,
        this.selectedFareClass,
        passengers,
        (result) => {
          this.selectedSeats = result.seats;
          this.seatFees = result.seatFee;
          this.updateSeatLabelsInForm();
          this.updatePriceBreakdown();
        }
      );
    }
  }

  updateSeatLabelsInForm() {
    Object.entries(this.selectedSeats).forEach(([idx, seatCode]) => {
      const label = document.getElementById(`pax-seat-label-${idx}`);
      if (label) {
        label.innerHTML = `Seat: <strong>${seatCode}</strong>`;
        label.classList.add("seat-assigned");
      }
    });
  }

  updatePriceBreakdown() {
    const summaryContainer = document.getElementById("fare-summary-details");
    if (!summaryContainer || !this.selectedOutboundFlight) return;

    const paxCount = this.getTotalPassengerCount();
    const fareMultiplier = this.getCabinMultiplier();
    const baseFarePerPax = Math.round(this.selectedOutboundFlight.basePrice * fareMultiplier);
    const totalBaseFare = baseFarePerPax * paxCount;
    const taxes = Math.round(totalBaseFare * 0.12);

    // Calculate ancillary costs
    let baggageFee = 0;
    let mealFee = 0;

    const cards = document.querySelectorAll("#passenger-cards-container .passenger-card");
    cards.forEach(card => {
      const bagVal = card.querySelector(".pax-baggage")?.value;
      const mealVal = card.querySelector(".pax-meal")?.value;
      
      const bagObj = window.AIRLINE_DATA.ancillaries.baggage.find(b => b.id === bagVal);
      if (bagObj) baggageFee += bagObj.price;

      const mealObj = window.AIRLINE_DATA.ancillaries.meals.find(m => m.id === mealVal);
      if (mealObj) mealFee += mealObj.price;
    });

    const insuranceFee = this.addons.insurance ? (window.AIRLINE_DATA.ancillaries.insurance.pricePerPax * paxCount) : 0;
    const priorityFee = this.addons.priority ? (window.AIRLINE_DATA.ancillaries.priority.pricePerPax * paxCount) : 0;

    const grandTotal = totalBaseFare + taxes + this.seatFees + baggageFee + mealFee + insuranceFee + priorityFee;

    this.currentFareBreakdown = {
      baseFare: totalBaseFare,
      taxes,
      seatFee: this.seatFees,
      baggageFee,
      mealFee,
      insuranceFee,
      priorityFee,
      total: grandTotal
    };

    summaryContainer.innerHTML = `
      <div class="summary-line">
        <span>Base Airfare (${paxCount}x ${this.selectedFareClass.toUpperCase()}):</span>
        <span>$${totalBaseFare}</span>
      </div>
      <div class="summary-line">
        <span>Taxes & Airport Security Fees:</span>
        <span>$${taxes}</span>
      </div>
      ${this.seatFees > 0 ? `
        <div class="summary-line">
          <span>Seat Selection Upgrades:</span>
          <span>$${this.seatFees}</span>
        </div>
      ` : ""}
      ${baggageFee > 0 ? `
        <div class="summary-line">
          <span>Extra Baggage:</span>
          <span>$${baggageFee}</span>
        </div>
      ` : ""}
      ${mealFee > 0 ? `
        <div class="summary-line">
          <span>Special Meals:</span>
          <span>$${mealFee}</span>
        </div>
      ` : ""}
      ${insuranceFee > 0 ? `
        <div class="summary-line">
          <span>Travel Insurance Protection:</span>
          <span>$${insuranceFee}</span>
        </div>
      ` : ""}
      ${priorityFee > 0 ? `
        <div class="summary-line">
          <span>Priority Boarding Pass:</span>
          <span>$${priorityFee}</span>
        </div>
      ` : ""}
      <div class="summary-divider"></div>
      <div class="summary-total">
        <span>Total Amount Due:</span>
        <span class="total-price">$${grandTotal}</span>
      </div>
    `;
  }

  toggleAddon(addonKey, isChecked) {
    this.addons[addonKey] = isChecked;
    this.updatePriceBreakdown();
  }

  proceedToPayment() {
    const passengers = this.collectPassengerData();
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.firstName || !p.lastName || !p.passport || !p.dob) {
        alert(`Please complete all required fields for Passenger ${i + 1}.`);
        return;
      }
    }

    const contactEmail = document.getElementById("contact-email")?.value;
    const contactPhone = document.getElementById("contact-phone")?.value;

    if (!contactEmail || !contactPhone) {
      alert("Please provide contact email and mobile phone number for ticket delivery.");
      return;
    }

    this.passengerData = passengers;
    this.contactData = { email: contactEmail, phone: contactPhone };

    // Update payment step review
    this.renderPaymentReview();
    this.showStep("payment-step");
  }

  renderPaymentReview() {
    const flight = this.selectedOutboundFlight;
    const reviewEl = document.getElementById("payment-flight-review");
    if (!reviewEl || !flight) return;

    const airline = window.AIRLINE_DATA.airlines[flight.airline];

    reviewEl.innerHTML = `
      <div class="review-flight-banner">
        <div class="banner-airline">
          <strong>${airline.name} (${flight.flightNumber})</strong>
          <span>${flight.aircraft} • ${this.selectedFareClass.toUpperCase()}</span>
        </div>
        <div class="banner-schedule">
          <span>${flight.origin} (${flight.departureTime}) ➔ ${flight.destination} (${flight.arrivalTime})</span>
          <span>Date: ${this.searchParams.departureDate}</span>
        </div>
      </div>
      <div class="review-pax-list">
        <strong>Passengers:</strong>
        <ul>
          ${this.passengerData.map((p, idx) => `
            <li>${p.title} ${p.firstName} ${p.lastName} — Seat: <strong>${p.seat || "Auto-assigned at gate"}</strong></li>
          `).join("")}
        </ul>
      </div>
    `;

    const totalEl = document.getElementById("payment-total-amount");
    if (totalEl && this.currentFareBreakdown) {
      totalEl.textContent = `$${this.currentFareBreakdown.total}`;
    }
  }

  processPayment() {
    const form = document.getElementById("payment-form");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const btn = document.getElementById("btn-pay-now");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Securing & Processing Payment...`;
    }

    setTimeout(() => {
      // Create confirmed booking record
      const bookingData = {
        flightId: this.selectedOutboundFlight.id,
        flightNumber: this.selectedOutboundFlight.flightNumber,
        airline: this.selectedOutboundFlight.airline,
        origin: this.selectedOutboundFlight.origin,
        destination: this.selectedOutboundFlight.destination,
        departureDate: this.searchParams.departureDate,
        departureTime: this.selectedOutboundFlight.departureTime,
        arrivalTime: this.selectedOutboundFlight.arrivalTime,
        duration: this.selectedOutboundFlight.duration,
        terminal: this.selectedOutboundFlight.terminal || "T1",
        gate: this.selectedOutboundFlight.gate || "A10",
        cabinClass: this.selectedFareClass,
        passengers: this.passengerData,
        contact: this.contactData,
        addons: this.addons,
        fareBreakdown: this.currentFareBreakdown,
        payment: {
          method: "Credit Card",
          cardLast4: document.getElementById("card-number")?.value.slice(-4) || "4242",
          transactionId: "TXN-" + Math.floor(1000000 + Math.random() * 9000000)
        }
      };

      const savedBooking = window.AirlineStorage.saveBooking(bookingData);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `Complete Payment & Reserve Ticket`;
      }

      this.showConfirmation(savedBooking);
    }, 1500);
  }

  showConfirmation(booking) {
    this.showStep("confirmation-step");
    this.renderBoardingPass(booking);
  }

  renderBoardingPass(booking) {
    const container = document.getElementById("confirmation-content");
    if (!container) return;

    const airline = window.AIRLINE_DATA.airlines[booking.airline] || { name: "AeroGlobal", color: "#1a56db", logoText: "✈️ AG" };
    const flight = window.AirlineStorage.getFlightById(booking.flightId) || {};

    let html = `
      <div class="confirmation-success-banner">
        <div class="success-icon">✓</div>
        <h2>Booking Confirmed! Have a wonderful flight.</h2>
        <p>A confirmation email and e-ticket have been sent to <strong>${booking.contact.email}</strong>.</p>
        <div class="pnr-highlight-box">
          <span>YOUR BOOKING REFERENCE (PNR)</span>
          <strong class="pnr-code">${booking.pnr}</strong>
          <button class="btn btn-sm btn-outline" onclick="navigator.clipboard.writeText('${booking.pnr}'); alert('PNR copied to clipboard!');">
            Copy PNR
          </button>
        </div>
      </div>

      <div class="boarding-passes-container">
        <h3>Boarding Passes (${booking.passengers.length})</h3>
    `;

    booking.passengers.forEach((pax, idx) => {
      html += `
        <div class="airline-boarding-pass" id="boarding-pass-${idx}">
          <!-- Pass Left: Main Flight Segment -->
          <div class="pass-main" style="border-top: 5px solid ${airline.color}">
            <div class="pass-header">
              <div class="pass-airline-brand">
                <span class="pass-logo" style="background-color: ${airline.color}">${airline.logoText}</span>
                <span class="pass-airline-name">${airline.name}</span>
              </div>
              <span class="pass-class-badge">${booking.cabinClass.toUpperCase()} CLASS</span>
            </div>

            <div class="pass-body">
              <div class="pass-row">
                <div class="pass-field">
                  <span class="field-label">PASSENGER NAME</span>
                  <span class="field-val">${pax.title} ${pax.firstName} ${pax.lastName}</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">FLIGHT</span>
                  <span class="field-val highlight">${booking.flightNumber}</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">DATE</span>
                  <span class="field-val">${booking.departureDate}</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">BOARDING GROUP</span>
                  <span class="field-val highlight">${booking.boardingGroup}</span>
                </div>
              </div>

              <div class="pass-route-row">
                <div class="route-point">
                  <span class="route-city">${booking.origin}</span>
                  <span class="route-time">${booking.departureTime}</span>
                </div>
                <div class="route-icon">✈️ <span>${booking.duration}</span></div>
                <div class="route-point">
                  <span class="route-city">${booking.destination}</span>
                  <span class="route-time">${booking.arrivalTime}</span>
                </div>
              </div>

              <div class="pass-row footer-row">
                <div class="pass-field">
                  <span class="field-label">TERMINAL</span>
                  <span class="field-val">${booking.terminal}</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">GATE</span>
                  <span class="field-val highlight">${booking.gate}</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">SEAT</span>
                  <span class="field-val seat-highlight">${pax.seat || "STANDBY"}</span>
                </div>
                <div class="pass-field">
                  <span class="field-label">PNR</span>
                  <span class="field-val">${booking.pnr}</span>
                </div>
              </div>
            </div>

            <!-- Realistic Barcode Visual -->
            <div class="pass-barcode-area">
              <div class="simulated-barcode"></div>
              <span class="barcode-number">ETKT-${booking.pnr}-${idx + 1}-001892</span>
            </div>
          </div>

          <!-- Perforation Divider -->
          <div class="pass-perforation">
            <div class="notch top"></div>
            <div class="dashed-line"></div>
            <div class="notch bottom"></div>
          </div>

          <!-- Pass Right: Stub / Gate Coupon -->
          <div class="pass-stub" style="border-top: 5px solid ${airline.color}">
            <div class="stub-header">
              <span>BOARDING PASS</span>
              <strong>${booking.flightNumber}</strong>
            </div>
            <div class="stub-info">
              <div class="stub-field">
                <label>PASSENGER</label>
                <span>${pax.lastName} / ${pax.firstName[0]}</span>
              </div>
              <div class="stub-field">
                <label>FROM / TO</label>
                <span>${booking.origin} ➔ ${booking.destination}</span>
              </div>
              <div class="stub-field">
                <label>GATE / SEAT</label>
                <strong>${booking.gate} / ${pax.seat || "STBY"}</strong>
              </div>
            </div>
            <div class="stub-qr">
              <div class="qr-box">
                <div class="simulated-qr"></div>
              </div>
              <span class="qr-caption">SCAN AT GATE</span>
            </div>
          </div>
        </div>
      `;
    });

    html += `
      </div>
      <div class="confirmation-actions">
        <button class="btn btn-primary" onclick="window.print()">
          🖨️ Print Boarding Passes
        </button>
        <button class="btn btn-secondary" onclick="window.App.switchTab('manage-tab'); window.Manage.searchPnr('${booking.pnr}');">
          📋 Manage This Booking
        </button>
        <button class="btn btn-outline" onclick="window.App.switchTab('book-tab'); window.Booking.resetAll();">
          ✈️ Book Another Flight
        </button>
      </div>
    `;

    container.innerHTML = html;
  }

  showStep(stepId) {
    document.querySelectorAll(".booking-step").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(stepId);
    if (target) {
      target.classList.add("active");
      target.scrollIntoView({ behavior: "smooth" });
    }
  }

  resetFilters() {
    this.activeFilters = {
      stops: "all",
      airlines: [],
      maxPrice: 1500,
      departureTime: "all",
      sortBy: "cheapest"
    };

    const stopsAll = document.querySelector('input[name="filter-stops"][value="all"]');
    if (stopsAll) stopsAll.checked = true;

    const priceSlider = document.getElementById("price-range-slider");
    if (priceSlider) {
      priceSlider.value = 1500;
      const priceVal = document.getElementById("price-range-val");
      if (priceVal) priceVal.textContent = "$1500";
    }

    this.renderSearchResults();
  }

  resetAll() {
    this.selectedOutboundFlight = null;
    this.selectedSeats = {};
    this.seatFees = 0;
    this.passengerData = [];
    this.showStep("search-step");
  }
}

window.Booking = new BookingEngine();
