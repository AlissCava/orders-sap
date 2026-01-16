/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["orders/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
