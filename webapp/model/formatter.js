sap.ui.define([], function () {
    "use strict";

    return {
        // ------------------------------------------------------------------------
        // 1. FORMATTAZIONE VALUTA
        // ------------------------------------------------------------------------
        currencyValue: function (sValue) {
            if (!sValue) {
                return "0.00 €";
            }
            return parseFloat(sValue).toFixed(2) + " €";
        },

        // ------------------------------------------------------------------------
        // 2. FORMATTAZIONE COLORE STATO
        // ------------------------------------------------------------------------
        statusState: function (sStatus) {
            if (sStatus === "Chiuso" || sStatus === 1) {
                return "Success"; // Verde
            } else if (sStatus === "Cancellato" || sStatus === 4) {
                return "Error"; // Rosso
            } else if (sStatus === "Creato") {
                return "Information"; // Azzurro
            } else {
                return "Warning"; // Arancione per "In elaborazione" e "In transito"
            }
        },

        // ------------------------------------------------------------------------
        // 3. FORMATTAZIONE ICONA STATO
        // ------------------------------------------------------------------------
        statusIcon: function (sStatus) {
            if (sStatus === "Chiuso" || sStatus === 1) {
                return "sap-icon://sys-enter-2"; // Spunta
            } else if (sStatus === "Cancellato" || sStatus === 4) {
                return "sap-icon://error"; // X rossa
            } else if (sStatus === "Creato") {
                return "sap-icon://add-document"; // Foglio nuovo
            } else if (sStatus === "In transito") {
                return "sap-icon://shipping-status"; // Camioncino
            } else {
                return "sap-icon://in-progress"; // Orologio per "In elaborazione"
            }
        },

        // ------------------------------------------------------------------------
        // 4. FORMATTAZIONE EURO ITALIANO
        // ------------------------------------------------------------------------
        formatItalianEuro: function (sValue) {
            if (!sValue) { 
                return "0,00 €"; 
            }
            var fValue = parseFloat(sValue);
            if (isNaN(fValue)) {
                return "0,00 €";
            }
            var sFormattedNumber = fValue.toLocaleString('it-IT', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
            return sFormattedNumber + " €";
        },

        // ------------------------------------------------------------------------
        // 5. FORMATTAZIONE DATA (gg/mm/aaaa)
        // ------------------------------------------------------------------------
        formatItalianDate: function (oDate) {
            if (!oDate) {
                return "";
            }

            var d = new Date(oDate);
            
            if (isNaN(d.getTime())) {
                return oDate;
            }

            var day = d.getDate().toString().padStart(2, '0');
            var month = (d.getMonth() + 1).toString().padStart(2, '0');
            var year = d.getFullYear();

            return day + "/" + month + "/" + year;
        }
    };
});