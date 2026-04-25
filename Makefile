PORT     ?= /dev/tty.usbserial-0001
BAUD     ?= 115200
FQBN     ?= esp32:esp32:esp32
SKETCH   := hardware/beacon

# ── Frontend ──────────────────────────────────────────────────────────────────
.PHONY: f
f:
	npm run dev

# ── Backend (Convex) ──────────────────────────────────────────────────────────
.PHONY: b
b:
	npm run convex:dev

# ── Flash ESP32 ───────────────────────────────────────────────────────────────
.PHONY: flash
flash:
	@command -v arduino-cli >/dev/null 2>&1 || { \
		echo "arduino-cli not found. Install it:"; \
		echo "  brew install arduino-cli"; \
		echo "  arduino-cli core install esp32:esp32"; \
		exit 1; \
	}
	arduino-cli compile --fqbn $(FQBN) $(SKETCH)
	arduino-cli upload  --fqbn $(FQBN) --port $(PORT) $(SKETCH)
	@echo "Flash complete. Opening serial monitor at $(BAUD) baud (Ctrl+C to exit)…"
	arduino-cli monitor --port $(PORT) --config baudrate=$(BAUD)

# ── Deploy everything ─────────────────────────────────────────────────────────
.PHONY: deploy
deploy:
	npm run convex:deploy
	npm run build
	@echo "Build complete — push dist/ to your gh-pages branch to publish."

# ── Helpers ───────────────────────────────────────────────────────────────────
.PHONY: install
install:
	npm install

.PHONY: help
help:
	@echo "make f       — start Vite dev server"
	@echo "make b       — start Convex dev backend"
	@echo "make flash   — compile & flash hardware/beacon/beacon.ino to $(PORT)"
	@echo "make deploy  — deploy Convex + build frontend for GitHub Pages"
	@echo "make install — npm install"
	@echo ""
	@echo "Override port:  make flash PORT=/dev/tty.usbserial-XXXX"
