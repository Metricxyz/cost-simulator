# cost-simulator

Public build of Metric's Costs Simulator - the page published at the calculator's domain.

**Generated, do not edit by hand.** Every file here is produced from the internal
simulator by `tools/build_public_simulator.py` in the `trade_dashboard` repo:

    python tools/build_public_simulator.py --standalone <path to this checkout>

That script strips all code comments and refuses to write if internal wording survives,
so the published page can never drift from the internal model or leak its provenance.
Edit the internal files and re-run the build instead of touching anything here.
