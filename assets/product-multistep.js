class ProductMultiStep {
  constructor(container) {
    this.container = container;
    this.currentStep = 1;
    this.totalSteps = 5;
    this.selectedVariant = null;
    this.selectedColor = null;
    this.selectedShellColor = null;
    this.selectedSmartOption = null;
    this.selectedAccessories = [];
    this.productData = null;
    this.accessoriesCollection = [];
    this.allSliderSlides = null;
    this.sectionsHidden = false;
    this.sliderInitialized = false;
    this.sliderEventHandlers = {
      touchstart: null,
      touchmove: null,
      touchend: null,
      mousedown: null,
      mousemove: null,
      mouseup: null,
      mouseleave: null,
    };

    // JSON state tracking - single source of truth
    this.cartState = {
      mainProductAdded: false,
      mainProductVariantId: null,
      mainProductProperties: {},
      accessories: [], // [{variantId, quantity, properties, title, price, image}]
    };

    // Variant image map: { variantId: imageUrl } for quick lookup
    this.variantImageMap = {};

    // Step navigation history for debugging
    this.stepHistory = [];

    // Debug event log
    this.debugEventLog = [];
    this.maxDebugLogEntries = 50;

    this.init();
  }

  async init() {
    this.loadProductData();
    this.attachEventListeners();
    this.attachBannerListeners();

    // Initialize cartState from cart on page load
    await this.initializeCartStateFromCart();

    // Initialize debug panel if enabled
    this.initDebugPanel();

    // console.log('=== Init Method ===');
    const sliderTrack = this.container.querySelector("[data-slider-track]");
    if (sliderTrack) {
      // console.log('Slider track found at init');
      // console.log('Initial slides count:', sliderTrack.querySelectorAll('.slider-slide').length);
      // console.log('Initial [data-media-slide] count:', sliderTrack.querySelectorAll('[data-media-slide]').length);
    } else {
      // console.log('No slider track at init');
    }

    const shellColorSelected = this.container.querySelector(
      'input[name="shell_color"]:checked'
    );
    if (shellColorSelected) {
      this.selectedShellColor = shellColorSelected.value;
      this.updateColorAvailability();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = urlParams.get("step");
    const initialStep =
      stepParam && !isNaN(stepParam) ? parseInt(stepParam) : 1;

    // If step is 2, 3, 4, or 5, trigger customize button (shows step 2)
    // For steps 3, 4, 5 - ignore them and just show step 2
    if (initialStep >= 2 && initialStep <= 5) {
      const customizeBtn = this.container.querySelector("[data-customize-btn]");
      if (customizeBtn) {
        // Update URL to step=2
        const newUrl = new URL(window.location);
        newUrl.searchParams.set("step", "2");
        window.history.replaceState({}, "", newUrl);

        // Trigger click on customize button to hide sections and enter fullscreen
        customizeBtn.click();
        this.currentSlide = 0;
        return;
      }
    }

    this.showStep(initialStep);
    this.currentSlide = 0;

    // Initialize step 1 price on load
    if (initialStep === 1) {
      this.updateStep1Price();
    }
  }

  loadProductData() {
    const productJsonScript = document.querySelector("[data-product-json]");
    if (productJsonScript) {
      try {
        this.productData = JSON.parse(productJsonScript.textContent);
      } catch (e) {
        // console.error('Error parsing product JSON:', e);
      }
    }

    // Load variant image map from Liquid-generated JSON (simpler and more reliable)
    const variantImageMapScript = document.querySelector(
      "[data-variant-image-map]"
    );
    if (variantImageMapScript) {
      try {
        this.variantImageMap = JSON.parse(variantImageMapScript.textContent);
        this.addDebugLog(
          "INFO",
          `Loaded variant image map from Liquid with ${
            Object.keys(this.variantImageMap).length
          } variants`
        );
      } catch (e) {
        // console.error('Error parsing variant image map:', e);
        this.variantImageMap = {};
      }
    } else {
      this.variantImageMap = {};
      this.addDebugLog("error", "Variant image map script tag not found");
    }
  }

  attachEventListeners() {
    const customizeBtn = this.container.querySelector("[data-customize-btn]");
    if (customizeBtn) {
      customizeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.hideAllSectionsExceptProduct();
        this.showStep(2);
      });
    }

    const nextBtns = this.container.querySelectorAll("[data-next-step]");
    nextBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const nextStep = parseInt(e.currentTarget.dataset.nextStep);
        this.handleNextStep(nextStep, e.currentTarget);
      });
    });

    const prevBtns = this.container.querySelectorAll("[data-prev-step]");
    prevBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // If on step 2, redirect to /pages/hp2
        if (this.currentStep === 2) {
          window.location.href = "/pages/hp2";
          return;
        }
        const prevStep = parseInt(e.currentTarget.dataset.prevStep);
        this.showStep(prevStep);
      });
    });

    const addSmartBtns = this.container.querySelectorAll(
      "[data-add-smart-btn]"
    );
    addSmartBtns.forEach((btn) => {
      btn.addEventListener("click", () => this.selectSmartOption(true, btn));
    });

    const skipSmartBtn = this.container.querySelector("[data-skip-smart-btn]");
    if (skipSmartBtn) {
      skipSmartBtn.addEventListener("click", () =>
        this.selectSmartOption(false)
      );
    }

    // CRITICAL: Use querySelectorAll to attach listeners to BOTH desktop and mobile checkout buttons
    // Desktop button has "desktop--only" class, mobile button has "mobile--only" class
    const checkoutBtns = this.container.querySelectorAll("[data-checkout-btn]");
    checkoutBtns.forEach((btn) => {
      btn.addEventListener("click", () => this.goToCheckout());
    });

    const swatchRadios = this.container.querySelectorAll("[data-swatch-radio]");
    swatchRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => this.handleSwatchChange(e));
    });
  }

  async handleNextStep(nextStep, btn) {
    if (this.currentStep === 2) {
      if (!this.validateStep2()) {
        alert("Please select both color and shell color");
        return;
      }
    }

    if (this.currentStep === 4 && nextStep === 5) {
      btn.disabled = true;

      this.addDebugLog(
        "STEP",
        `handleNextStep: Going to step 5, cartState before: ${JSON.stringify(
          this.cartState
        )}, selectedAccessories: ${JSON.stringify(this.selectedAccessories)}`
      );

      // CRITICAL: Always add the selected variant to cart (preserve existing items)
      // E-commerce standard: If cart has variant A and user selects variant B, cart should have BOTH
      if (this.selectedVariant) {
        const cart = await this.getCart();
        this.addDebugLog(
          "STEP",
          `handleNextStep: Checking cart, has ${cart.items.length} items, selected variant: ${this.selectedVariant.id}`
        );

        // Check if selected variant is already in cart
        const selectedVariantInCart = cart.items.find(
          (item) => item.variant_id === this.selectedVariant.id
        );

        if (!selectedVariantInCart) {
          // Selected variant NOT in cart - add it (preserve existing items)
          this.cartState.mainProductAdded = true;
          this.cartState.mainProductVariantId = this.selectedVariant.id;
          this.cartState.mainProductProperties = this.getDeliveryProperties();
          this.addDebugLog(
            "STEP",
            `handleNextStep: Selected variant ${this.selectedVariant.id} not in cart, will add it (preserving existing items)`
          );
        } else {
          // Selected variant already in cart - just update cartState to reflect it
          this.cartState.mainProductAdded = true;
          this.cartState.mainProductVariantId = this.selectedVariant.id;
          this.cartState.mainProductProperties =
            selectedVariantInCart.properties || this.getDeliveryProperties();
          this.addDebugLog(
            "STEP",
            `handleNextStep: Selected variant ${this.selectedVariant.id} already in cart, updating cartState`
          );
        }
      }

      // Update cartState with current selections
      await this.updateCartStateFromAccessories();
      this.addDebugLog(
        "STEP",
        `handleNextStep: After updateCartStateFromAccessories, cartState: ${JSON.stringify(
          this.cartState
        )}`
      );

      // Sync cart to match cartState JSON
      await this.syncCartToState();

      // After cart sync finishes, render summary
      btn.disabled = false;
      this.showStep(nextStep);
    } else {
      this.showStep(nextStep);
    }

    // Update debug panel after navigation
    if (this.debugEnabled) {
      try {
        await this.updateDebugPanel();
      } catch (err) {
        console.error("Debug panel update error:", err);
      }
    }
  }

  selectSmartOption(addSmart, btn = null) {
    const smartOptionInput = this.container.querySelector(
      "[data-smart-option-input]"
    );
    if (!smartOptionInput) {
      // console.error('Smart option input not found');
      return;
    }

    // console.log('Smart option selected:', addSmart);
    // console.log('Smart value:', smartOptionInput.dataset.smartValue);
    // console.log('Non-smart value:', smartOptionInput.dataset.nonSmartValue);

    if (addSmart) {
      this.selectedSmartOption = smartOptionInput.dataset.smartValue;
    } else {
      this.selectedSmartOption = smartOptionInput.dataset.nonSmartValue;
    }

    // console.log('Selected smart option:', this.selectedSmartOption);
    smartOptionInput.value = this.selectedSmartOption;

    this.selectFinalVariant();

    if (addSmart && btn) {
      const addText = btn.querySelector(".btn-text-add");
      const addedText = btn.querySelector(".btn-text-added");

      if (addText && addedText) {
        addText.style.display = "none";
        addedText.style.display = "flex";
        btn.classList.add("showing-added");

        setTimeout(() => {
          addText.style.display = "inline-block";
          addedText.style.display = "none";
          btn.classList.remove("showing-added");
          this.showStep(4);
        }, 2000);
      } else {
        this.showStep(4);
      }
    } else {
      this.showStep(4);
    }
  }

  handleSwatchChange() {
    const colorSelected = this.container.querySelector(
      'input[name="color"]:checked'
    );
    const shellColorSelected = this.container.querySelector(
      'input[name="shell_color"]:checked'
    );

    if (shellColorSelected) {
      this.selectedShellColor = shellColorSelected.value;
      this.updateColorAvailability();
    }

    if (colorSelected && shellColorSelected) {
      this.selectedColor = colorSelected.value;
      this.selectedShellColor = shellColorSelected.value;
      this.selectPartialVariant();

      // Update step 3 upgrade price if we're on step 3
      if (this.currentStep === 3) {
        this.updateStep3UpgradePrice();
      }
    }
  }

  updateColorAvailability() {
    if (!this.productData || !this.selectedShellColor) return;

    const colorInputs = this.container.querySelectorAll('input[name="color"]');

    colorInputs.forEach((input) => {
      const color = input.value;

      // Find variant matching shell color + fabric color
      const matchingVariant = this.productData.variants.find((v) => {
        const matchesShell =
          v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
          v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
          v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

        const matchesColor =
          v.option1?.toLowerCase() === color?.toLowerCase() ||
          v.option2?.toLowerCase() === color?.toLowerCase() ||
          v.option3?.toLowerCase() === color?.toLowerCase();

        return matchesShell && matchesColor;
      });

      const swatchWrapper = input.closest(".swatch-option");
      if (swatchWrapper) {
        let textBelow = swatchWrapper.querySelector(".swatch-text-below");
        let soldOutDiv = swatchWrapper.querySelector(".swatch-sold-out-fabric");

        // Check if variant should be completely hidden (hidevariant metafield)
        const shouldHideCompletely =
          matchingVariant?.metafields?.hidevariant === true;

        // Check if variant should be disabled (sold out or doesn't exist)
        const shouldDisable = !matchingVariant || !matchingVariant.available;

        if (shouldHideCompletely) {
          // Completely hide the option when hidevariant = true
          swatchWrapper.style.display = "none";
          input.disabled = true;
          if (input.checked) {
            input.checked = false;
            this.selectedColor = null;
          }
        } else if (shouldDisable) {
          // Mark as sold out when variant doesn't exist or is unavailable
          swatchWrapper.style.display = "";
          swatchWrapper.classList.add("swatch-option--disabled");
          input.disabled = true;
          if (input.checked) {
            input.checked = false;
            this.selectedColor = null;
          }
          if (textBelow) {
            textBelow.remove();
          }
          if (soldOutDiv) {
            soldOutDiv.innerHTML = "<small>Sold Out</small>";
          }
        } else {
          // Variant is available - show and enable
          swatchWrapper.style.display = "";
          swatchWrapper.classList.remove("swatch-option--disabled");
          input.disabled = false;

          if (!textBelow) {
            textBelow = document.createElement("span");
            textBelow.className = "swatch-text-below";
            const label = swatchWrapper.querySelector(".swatch-label");
            label.insertAdjacentElement("afterend", textBelow);
          }
          textBelow.innerHTML = color;

          if (soldOutDiv) {
            soldOutDiv.innerHTML = "";
          }
        }
      }
    });
  }

  validateStep2() {
    this.selectedColor = this.container.querySelector(
      'input[name="color"]:checked'
    )?.value;
    this.selectedShellColor = this.container.querySelector(
      'input[name="shell_color"]:checked'
    )?.value;

    if (this.selectedColor && this.selectedShellColor) {
      this.selectPartialVariant();
      return true;
    }
    return false;
  }

  selectPartialVariant() {
    if (!this.productData) return;

    const variant = this.productData.variants.find((v) => {
      const matchesColor =
        v.option1?.toLowerCase() === this.selectedColor?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedColor?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedColor?.toLowerCase();

      const matchesShell =
        v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

      return matchesColor && matchesShell;
    });

    if (variant) {
      this.updateImages(variant);
      this.updatePrice(variant);
    }

    this.filterSliderImages();
  }

  selectFinalVariant() {
    if (!this.productData) return;

    // console.log('Selecting variant with:', {
    //   color: this.selectedColor,
    //   shell: this.selectedShellColor,
    //   smart: this.selectedSmartOption
    // });

    const variant = this.productData.variants.find((v) => {
      const matchesColor =
        v.option1?.toLowerCase() === this.selectedColor?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedColor?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedColor?.toLowerCase();

      const matchesShell =
        v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

      const matchesSmart =
        v.option1?.toLowerCase() === this.selectedSmartOption?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedSmartOption?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedSmartOption?.toLowerCase();

      return matchesColor && matchesShell && matchesSmart;
    });

    if (variant) {
      // console.log('Found variant:', variant.id, variant.title);
      this.selectedVariant = variant;
      this.updateImages(variant);
      this.updatePrice(variant);
    } else {
      // console.error('No variant found matching selections');
    }

    this.filterSliderImages();
  }

  updateImages(variant) {
    const event = new CustomEvent("theme:variant:change", {
      detail: { variant: variant },
      bubbles: true,
    });

    this.container.dispatchEvent(event);

    // Trigger Shopify's native variant change event for app compatibility
    this.triggerNativeVariantChange(variant);

    if (this.currentStep === 2 && variant.featured_image?.src) {
      const variantImg = this.container.querySelector("[data-variant-image]");
      if (variantImg) {
        variantImg.src = variant.featured_image.src.replace(
          /\.(jpg|jpeg|gif|png|bmp|bitmap|tiff|tif)(\?v=\d+)?$/i,
          "_800x.$1$2"
        );
        this.goToSlide(0);
      }
    }
  }

  triggerNativeVariantChange(variant) {
    if (!variant) return;

    // Find the product form variant input
    const productForm =
      document.querySelector("[data-product-form]") ||
      document.querySelector('form[action*="/cart/add"]') ||
      this.container.closest("form");

    if (productForm) {
      // Update the variant ID input
      const variantInput = productForm.querySelector('input[name="id"]');
      if (variantInput) {
        variantInput.value = variant.id;

        // Trigger change event on the input
        variantInput.dispatchEvent(new Event("change", { bubbles: true }));
      }

      // Dispatch Shopify's native variant:change event
      const variantChangeEvent = new CustomEvent("variant:change", {
        detail: { variant: variant },
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(variantChangeEvent);
    }
  }

  filterSliderImages() {
    // console.log('=== Filter Slider Images Called ===');
    // console.log('Current step:', this.currentStep);
    // console.log('Selected shell color:', this.selectedShellColor);
    // console.log('Selected fabric color:', this.selectedColor);

    if (this.currentStep !== 2) {
      // console.log('Not on step 2, exiting');
      return;
    }

    const step2 = this.container.querySelector('[data-step="2"]');
    if (!step2) {
      // console.log('Step 2 not found');
      return;
    }
    // console.log('Step 2 display:', step2.style.display);

    const slideshow = step2.querySelector("[data-slider-track]");
    if (!slideshow) {
      // console.log('No slideshow found');
      return;
    }
    // console.log('Slideshow found:', slideshow);

    if (!this.allSliderSlides || this.allSliderSlides.length === 0) {
      // console.log('No original slides stored, exiting');
      return;
    }

    // console.log('Using stored original slides:', this.allSliderSlides.length);
    const allSlides = this.allSliderSlides.map((slide) =>
      slide.cloneNode(true)
    );

    if (!this.selectedShellColor && !this.selectedColor) {
      // console.log('No selections made, showing all slides');
      allSlides.forEach((slide) => (slide.style.display = ""));
      return;
    }

    // console.log('--- Checking each slide ---');
    const exactMatches = [];
    const shellMatches = [];
    const otherSlides = [];

    allSlides.forEach((slide, index) => {
      const img = slide.querySelector("img");
      const altText = img ? (img.alt || "").toLowerCase().trim() : "";
      // console.log(`Slide ${index + 1} alt text:`, altText);

      if (this.selectedShellColor && this.selectedColor) {
        const exactPattern =
          `${this.selectedShellColor} / ${this.selectedColor}`
            .toLowerCase()
            .trim();
        const shellPattern =
          this.selectedShellColor.toLowerCase().trim() + " /";

        // console.log(`  Checking exact match: "${exactPattern}"`);
        if (altText === exactPattern) {
          // console.log(`  Exact match!`);
          exactMatches.push(slide);
        } else if (altText.startsWith(shellPattern)) {
          // console.log(`  Shell color match`);
          shellMatches.push(slide);
        } else {
          // console.log(`  No match`);
          otherSlides.push(slide);
        }
      } else if (this.selectedShellColor) {
        const shellPattern =
          this.selectedShellColor.toLowerCase().trim() + " /";
        if (altText.startsWith(shellPattern)) {
          shellMatches.push(slide);
        } else {
          otherSlides.push(slide);
        }
      }
    });

    // console.log('Exact matches:', exactMatches.length);
    // console.log('Shell matches:', shellMatches.length);
    // console.log('Other slides:', otherSlides.length);

    let visibleSlides = [];

    if (exactMatches.length > 0) {
      // console.log('Using exact matches');
      visibleSlides = exactMatches;
    } else if (shellMatches.length > 0) {
      // console.log('No exact matches, using shell color matches');
      visibleSlides = shellMatches;
    } else {
      // console.log('No matches found, showing all slides');
      allSlides.forEach((slide) => (slide.style.display = ""));
      return;
    }

    // console.log('Rebuilding slideshow with', visibleSlides.length, 'visible slides');
    slideshow.innerHTML = "";

    visibleSlides.forEach((slide, index) => {
      // console.log(`Appending slide ${index + 1}`);
      slide.style.display = "";
      slideshow.appendChild(slide);
    });

    // console.log('Final slideshow children count:', slideshow.children.length);

    // console.log('Going to slide 0');
    this.currentSlide = 0;
    slideshow.style.transform = "translateX(0%)";
    this.updateSliderArrows();

    // Re-initialize slider after content change (but handlers are already attached)
    if (this.sliderInitialized) {
      // Just update arrows, don't re-add listeners
      this.updateSliderArrows();
    }
    // console.log('=== Filter Complete ===');
  }

  updatePrice(variant) {
    const priceElements = this.container.querySelectorAll(
      "[data-product-price]"
    );
    priceElements.forEach((el) => {
      if (variant.price) {
        const formattedPrice = this.formatMoney(variant.price);
        el.textContent = formattedPrice;
      }
    });
  }

  formatMoney(cents) {
    const dollars = cents / 100;
    return "$" + dollars.toFixed(2);
  }

  updateStep1Price() {
    if (!this.productData || !this.productData.variants) return;

    // Find lowest price variant from available variants only
    const availableVariants = this.productData.variants.filter(
      (v) => v.available
    );
    if (availableVariants.length === 0) return;

    let lowestVariant = availableVariants[0];
    for (let i = 1; i < availableVariants.length; i++) {
      if (availableVariants[i].price < lowestVariant.price) {
        lowestVariant = availableVariants[i];
      }
    }

    const priceElement = this.container.querySelector("[data-product-price]");
    if (!priceElement) return;

    const lowestPrice = this.formatMoney(lowestVariant.price);

    if (
      lowestVariant.compare_at_price &&
      lowestVariant.compare_at_price > lowestVariant.price
    ) {
      const compareAtPrice = this.formatMoney(lowestVariant.compare_at_price);
      priceElement.innerHTML = `${lowestPrice} <span style="text-decoration: line-through; font-weight: 400; font-size: 0.7em;">${compareAtPrice}</span>`;
    } else {
      priceElement.textContent = lowestPrice;
    }
  }

  getSmartUpgradePrice() {
    if (!this.productData || !this.productData.variants) return null;
    if (!this.selectedColor || !this.selectedShellColor) return null;

    // Find all variants matching the selected shell color and fabric color
    const matchingVariants = this.productData.variants.filter((v) => {
      if (!v.available) return false;

      const matchesShell =
        v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

      const matchesColor =
        v.option1?.toLowerCase() === this.selectedColor?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedColor?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedColor?.toLowerCase();

      return matchesShell && matchesColor;
    });

    if (matchingVariants.length < 2) {
      // Need at least 2 variants (smart and classic) for the same color combo
      return null;
    }

    // Sort by price to find lowest (classic) and highest (smart)
    matchingVariants.sort((a, b) => a.price - b.price);
    const classicVariant = matchingVariants[0];
    const smartVariant = matchingVariants[matchingVariants.length - 1];

    // Calculate upgrade difference
    const upgradeDifference = smartVariant.price - classicVariant.price;
    const upgradePrice = this.formatMoney(upgradeDifference);

    if (
      smartVariant.compare_at_price &&
      smartVariant.compare_at_price > smartVariant.price
    ) {
      const strikethroughDifference =
        smartVariant.compare_at_price - classicVariant.price;
      const strikethroughPrice = this.formatMoney(strikethroughDifference);
      return `${upgradePrice} <span style="text-decoration: line-through; font-weight: 400; font-size: 0.7em;">${strikethroughPrice}</span>`;
    } else {
      return upgradePrice;
    }
  }

  updateStep3UpgradePrice() {
    const priceHtml = this.getSmartUpgradePrice();
    if (!priceHtml) return;

    const priceElement = this.container.querySelector(".price-smart-multistep");
    if (!priceElement) return;

    if (typeof priceHtml === "string" && priceHtml.includes("<span")) {
      priceElement.innerHTML = priceHtml;
    } else {
      priceElement.textContent = priceHtml;
    }
  }

  getImageUrl(imageUrl, size = 400) {
    if (!imageUrl) return "";

    if (typeof imageUrl === "string") {
      const url = imageUrl.replace(
        /\.(jpg|jpeg|gif|png|bmp|bitmap|tiff|tif)(\?v=\d+)?$/i,
        `_${size}x.$1$2`
      );
      return url;
    }

    return imageUrl;
  }

  async addToCart(variantId, quantity = 1, properties = {}) {
    const formData = {
      items: [
        {
          id: variantId,
          quantity: quantity,
          properties: properties,
        },
      ],
    };

    // console.log('Adding to cart:', formData);

    try {
      const response = await fetch("/cart/add.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const result = await response.json();
        this.addDebugLog(
          "CART",
          `Added to cart: variantId ${variantId}, quantity ${quantity}`
        );
        const cart = await fetch("/cart.js").then((r) => r.json());
        document.dispatchEvent(
          new CustomEvent("theme:cart:change", {
            detail: { cart: cart },
            bubbles: true,
          })
        );
        return true;
      } else {
        const error = await response.json();
        this.addDebugLog("error", `Cart add failed: ${JSON.stringify(error)}`);
        return false;
      }
    } catch (error) {
      // Ignore third-party script errors (like loomi.jitsu) that intercept fetch
      // Only log actual cart errors
      if (
        error.message &&
        !error.message.includes("loomi") &&
        !error.message.includes("jitsu")
      ) {
        this.addDebugLog(
          "error",
          `Error adding to cart: ${error.message}`,
          error
        );
      }
      // Still try to proceed - the cart operation might have succeeded despite the error
      // Check cart state to verify
      try {
        const cart = await this.getCart();
        const itemInCart = cart.items.find(
          (item) => item.variant_id === variantId
        );
        if (itemInCart) {
          this.addDebugLog(
            "CART",
            `Cart add succeeded despite error (item found in cart)`
          );
          return true;
        }
      } catch (checkError) {
        // Ignore check errors
      }
      return false;
    }
  }

  filterAccessoriesBySmartOption() {
    const container = this.container.querySelector(
      "[data-accessories-container]"
    );
    if (!container) return;

    const accessoryItems = container.querySelectorAll("[data-accessory-item]");
    const smartOptionLower = (this.selectedSmartOption || "").toLowerCase();
    const isSmartSelected =
      smartOptionLower.includes("smart") &&
      !smartOptionLower.includes("non") &&
      !smartOptionLower.includes("classic") &&
      !smartOptionLower.startsWith("no ") &&
      !smartOptionLower.startsWith("no-");

    accessoryItems.forEach((item) => {
      const titleElement = item.querySelector("h4");
      if (!titleElement) return;

      const productName = titleElement.textContent.trim().toLowerCase();
      let shouldHide = false;

      if (isSmartSelected) {
        // If smart selected, hide accessories with "classic" in name
        if (productName.includes("classic")) {
          shouldHide = true;
        }
      } else {
        // If non-smart selected, hide accessories with "smart" in name
        // But don't hide if it starts with "no " or "no-" (e.g., "No Smart Capabilities")
        const hasSmartInName = productName.includes("smart");
        const startsWithNo =
          productName.startsWith("no ") || productName.startsWith("no-");
        if (hasSmartInName && !startsWithNo) {
          shouldHide = true;
        }
      }

      item.style.display = shouldHide ? "none" : "";
    });
  }

  attachAccessoryListeners() {
    const container = this.container.querySelector(
      "[data-accessories-container]"
    );
    if (!container) return;

    const accessoryItems = container.querySelectorAll("[data-accessory-item]");
    accessoryItems.forEach((item) => {
      const variantOptions = item.querySelectorAll("[data-variant-option]");
      const checkbox = item.querySelector("[data-accessory-checkbox]");

      variantOptions.forEach((option) => {
        // Prevent duplicate listeners
        if (option.dataset.listenerAttached) return;
        option.dataset.listenerAttached = "true";

        option.addEventListener("change", (e) => {
          this.updateAccessoryVariant(item);
          this.updateAccessoryImage(item, e.target);
        });
      });

      if (checkbox) {
        // Prevent duplicate listeners
        if (checkbox.dataset.listenerAttached) {
          this.addDebugLog(
            "SKIP",
            `Duplicate listener attachment for checkbox: ${checkbox.dataset.accessoryId}`
          );
          return;
        }
        checkbox.dataset.listenerAttached = "true";
        this.addDebugLog(
          "ATTACH",
          `Listener attached to checkbox: ${checkbox.dataset.accessoryId}`
        );

        checkbox.addEventListener("change", (e) => {
          this.addDebugLog(
            "EVENT",
            `Checkbox change: ${e.target.dataset.accessoryId}, checked: ${e.target.checked}`
          );
          const variantId = parseInt(e.target.dataset.accessoryId);
          const accessoryTitle = e.target.dataset.accessoryTitle;
          const accessoryPrice = parseInt(e.target.dataset.accessoryPrice);
          const accessoryImage =
            item.querySelector("[data-accessory-image]")?.src || "";

          if (e.target.checked) {
            const productId = parseInt(e.target.dataset.productId);
            const productHandle =
              item.closest("[data-accessory-item]")?.dataset.productHandle ||
              null;
            this.addAccessory(
              variantId,
              accessoryTitle,
              accessoryPrice,
              accessoryImage,
              productId,
              productHandle
            );

            if (checkbox.autoUncheckTimeout) {
              clearTimeout(checkbox.autoUncheckTimeout);
            }

            checkbox.isAutoUnchecking = false;
            checkbox.autoUncheckTimeout = setTimeout(() => {
              checkbox.isAutoUnchecking = true;
              checkbox.checked = false;
              setTimeout(() => {
                checkbox.isAutoUnchecking = false;
              }, 100);
            }, 2000);
          } else {
            if (checkbox.autoUncheckTimeout) {
              clearTimeout(checkbox.autoUncheckTimeout);
            }

            if (!checkbox.isAutoUnchecking) {
              this.removeAccessory(variantId);
            }
          }
        });
      }
    });
  }

  updateAccessoryVariant(item) {
    const checkbox = item.querySelector("[data-accessory-checkbox]");
    if (!checkbox) return;

    const selectedOptions = [];
    const variantOptions = item.querySelectorAll(
      "[data-variant-option]:checked"
    );

    variantOptions.forEach((option) => {
      const position = parseInt(option.dataset.optionPosition);
      selectedOptions[position - 1] = option.value;
    });

    // Find the selected variant ID from checked options
    const selectedVariantId =
      variantOptions.length > 0
        ? parseInt(variantOptions[variantOptions.length - 1].dataset.variantId)
        : null;

    if (selectedVariantId) {
      // Get selected variant option to get price
      const selectedOption = Array.from(variantOptions).find(
        (opt) => parseInt(opt.dataset.variantId) === selectedVariantId
      );

      if (selectedOption) {
        // Update checkbox with new variant ID, price, and availability
        checkbox.dataset.accessoryId = selectedVariantId;
        checkbox.dataset.accessoryPrice =
          selectedOption.dataset.variantPrice ||
          checkbox.dataset.accessoryPrice;
        checkbox.dataset.variantAvailable = "true";
        checkbox.disabled = false;

        // Update displayed price
        const priceEl = item.querySelector(".accessory-item__price");
        const comparePriceEl = item.querySelector(
          ".accessory-item__compare-price"
        );
        if (priceEl && selectedOption.dataset.variantPrice) {
          const variantPrice = parseInt(selectedOption.dataset.variantPrice);
          const discountedPrice = Math.round(variantPrice * 0.8);
          priceEl.textContent = `$${(discountedPrice / 100).toFixed(2)}`;
          if (comparePriceEl) {
            comparePriceEl.textContent = `$${(variantPrice / 100).toFixed(2)}`;
          }
        }

        // If checkbox was checked, update the accessory in selection
        const wasChecked = checkbox.checked;
        const oldVariantId = parseInt(checkbox.dataset.accessoryId);

        if (wasChecked && oldVariantId !== selectedVariantId) {
          this.removeAccessory(oldVariantId);
          // Re-add with new variant
          const accessoryTitle = checkbox.dataset.accessoryTitle;
          const accessoryPrice = parseInt(checkbox.dataset.accessoryPrice);
          const accessoryImage =
            item.querySelector("[data-accessory-image]")?.src || "";
          const productId = parseInt(checkbox.dataset.productId);
          const productHandle =
            item.closest("[data-accessory-item]")?.dataset.productHandle ||
            null;
          this.addAccessory(
            selectedVariantId,
            accessoryTitle,
            accessoryPrice,
            accessoryImage,
            productId,
            productHandle
          );
        }
      }
    }
  }

  updateAccessoryImage(item, changedOption) {
    const imageEl = item.querySelector("[data-accessory-image]");
    if (!imageEl) return;

    const variantImagesData = item.dataset.variantImages;
    let customImageUrl = null;

    if (variantImagesData) {
      try {
        const variantImages = JSON.parse(variantImagesData);
        const selectedVariantId = changedOption.dataset.variantId;

        if (selectedVariantId && variantImages[selectedVariantId]) {
          customImageUrl = variantImages[selectedVariantId];
        }
      } catch (e) {
        // console.error('Error parsing variant images:', e);
      }
    }

    if (customImageUrl) {
      imageEl.src = customImageUrl;
    } else {
      const newImageUrl = changedOption.dataset.variantImage;
      if (newImageUrl) {
        imageEl.src = newImageUrl;
      }
    }
  }

  addAccessory(
    variantId,
    title,
    price,
    image,
    productId = null,
    productHandle = null
  ) {
    this.addDebugLog(
      "CALL",
      `addAccessory() called for variantId: ${variantId}`
    );
    const existing = this.selectedAccessories.find(
      (acc) => acc.id === variantId
    );
    if (!existing) {
      this.addDebugLog("ADD", `Adding new accessory, quantity: 1`);
      this.selectedAccessories.push({
        id: variantId,
        title: title,
        price: price,
        image: image,
        quantity: 1,
        productId: productId,
        productHandle: productHandle,
      });
    } else {
      this.addDebugLog(
        "INCR",
        `Accessory exists, incrementing quantity from ${existing.quantity} to ${
          existing.quantity + 1
        }`
      );
      existing.quantity++;
    }

    // Update cartState JSON
    this.updateCartStateFromAccessories();
  }

  removeAccessory(variantId) {
    // console.log('Removing accessory:', variantId);
    const index = this.selectedAccessories.findIndex(
      (acc) => acc.id === variantId
    );
    if (index > -1) {
      const accessory = this.selectedAccessories[index];
      // console.log('Found accessory at index:', index, 'with quantity:', accessory.quantity);

      if (accessory.quantity > 1) {
        accessory.quantity--;
        // console.log('Quantity decreased to:', accessory.quantity);
      } else {
        this.selectedAccessories.splice(index, 1);
        // console.log('Accessory removed completely');
      }
    }

    // Update cartState JSON
    this.updateCartStateFromAccessories();

    // Update debug panel
    if (this.debugEnabled) {
      this.updateDebugPanel().catch((err) =>
        console.error("Debug panel update error:", err)
      );
    }
  }

  showStep(stepNumber) {
    // console.log('=== Show Step Called ===', stepNumber);
    const previousStep = this.currentStep;
    this.currentStep = stepNumber;

    // Track step navigation history
    this.stepHistory.push({
      timestamp: new Date().toISOString(),
      from: previousStep,
      to: stepNumber,
      action: previousStep < stepNumber ? "NEXT" : "BACK",
    });

    // Keep only last 50 steps
    if (this.stepHistory.length > 50) {
      this.stepHistory.shift();
    }

    // Update debug panel
    if (this.debugEnabled) {
      this.updateDebugPanel();
    }

    const header = document.querySelector(".header__wrapper");
    if (header) {
      if (stepNumber >= 2) {
        header.style.display = "none";
      } else {
        header.style.display = "";
      }
    }

    const steps = this.container.querySelectorAll("[data-step]");
    steps.forEach((step) => {
      const stepNum = parseInt(step.dataset.step);
      step.style.display = stepNum === stepNumber ? "block" : "none";
    });
    // console.log('Step visibility updated');

    if (stepNumber >= 2) {
      document.body.classList.add("multistep-fullscreen");
    } else {
      document.body.classList.remove("multistep-fullscreen");
      // Restore all sections when going back to step 1
      if (this.sectionsHidden) {
        this.restoreAllSections();
      }
    }

    window.scrollTo(0, 0);

    const mainContent = document.querySelector("#MainContent");
    if (mainContent) {
      mainContent.scrollTo(0, 0);
    }

    this.updateProgress();

    // Update step 1 price when showing step 1
    if (stepNumber === 1) {
      this.updateStep1Price();
    }

    // Update step 3 upgrade price when showing step 3
    if (stepNumber === 3) {
      this.updateStep3UpgradePrice();
    }

    if (stepNumber === 2) {
      // Get default selected swatches and filter gallery
      const colorSelected = this.container.querySelector(
        'input[name="color"]:checked'
      );
      const shellColorSelected = this.container.querySelector(
        'input[name="shell_color"]:checked'
      );

      if (shellColorSelected) {
        this.selectedShellColor = shellColorSelected.value;
        this.updateColorAvailability();
      }

      if (colorSelected && shellColorSelected) {
        this.selectedColor = colorSelected.value;
        this.selectedShellColor = shellColorSelected.value;
        this.selectPartialVariant();
      }

      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        this.initializeSlider();
        // Filter gallery based on default selections
        if (this.selectedShellColor || this.selectedColor) {
          this.filterSliderImages();
        }
      });
    }

    if (stepNumber === 3) {
      // Play all videos in step 3 when entering
      this.playStep3Videos();
    } else {
      // Pause all videos when leaving step 3
      this.pauseStep3Videos();
    }

    if (stepNumber === 4) {
      this.filterAccessoriesBySmartOption();
      this.attachAccessoryListeners();
    }

    if (stepNumber === 5) {
      this.renderOrderSummary().catch((error) => {
        console.error("Error rendering order summary:", error);
      });
    }
  }

  playStep3Videos() {
    const step3 = this.container.querySelector('[data-step="3"]');
    if (!step3) return;

    const videoWrappers = step3.querySelectorAll(".video-autoplay-wrapper");
    videoWrappers.forEach((wrapper) => {
      const video = wrapper.querySelector("video");
      if (video) {
        video.muted = true;
        video.play().catch((e) => {
          // Autoplay failed, ignore silently
        });
      }
    });
  }

  pauseStep3Videos() {
    const step3 = this.container.querySelector('[data-step="3"]');
    if (!step3) return;

    const videoWrappers = step3.querySelectorAll(".video-autoplay-wrapper");
    videoWrappers.forEach((wrapper) => {
      const video = wrapper.querySelector("video");
      if (video) {
        video.pause();
        video.currentTime = 0; // Reset to beginning
      }
    });
  }

  initializeSlider() {
    // Prevent multiple initializations
    if (this.sliderInitialized) {
      this.updateSliderArrows();
      return;
    }

    const sliderTrack = this.container.querySelector("[data-slider-track]");
    const prevBtn = this.container.querySelector("[data-slider-prev]");
    const nextBtn = this.container.querySelector("[data-slider-next]");

    if (!sliderTrack) {
      return;
    }

    const slides = sliderTrack.querySelectorAll(".slider-slide");

    if (!this.allSliderSlides) {
      this.allSliderSlides = Array.from(slides).map((slide) =>
        slide.cloneNode(true)
      );
    }

    if (slides.length === 0) return;

    // Store button click handlers
    if (prevBtn && !prevBtn.dataset.listenerAttached) {
      prevBtn.addEventListener("click", () => {
        if (this.currentSlide > 0) {
          this.goToSlide(this.currentSlide - 1);
        }
      });
      prevBtn.dataset.listenerAttached = "true";
    }

    if (nextBtn && !nextBtn.dataset.listenerAttached) {
      nextBtn.addEventListener("click", () => {
        const slides = sliderTrack.querySelectorAll(".slider-slide");
        if (this.currentSlide < slides.length - 1) {
          this.goToSlide(this.currentSlide + 1);
        }
      });
      nextBtn.dataset.listenerAttached = "true";
    }

    this.updateSliderArrows();

    // Store drag state outside event handlers to avoid closure issues
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    // Create event handlers once
    if (!this.sliderEventHandlers.touchstart) {
      this.sliderEventHandlers.touchstart = (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
      };

      this.sliderEventHandlers.touchmove = (e) => {
        if (!isDragging) return;
        currentX = e.touches[0].clientX;
      };

      this.sliderEventHandlers.touchend = () => {
        if (!isDragging) return;
        isDragging = false;

        const diff = startX - currentX;
        const slides = sliderTrack.querySelectorAll(".slider-slide");

        if (Math.abs(diff) > 50) {
          if (diff > 0 && this.currentSlide < slides.length - 1) {
            this.goToSlide(this.currentSlide + 1);
          } else if (diff < 0 && this.currentSlide > 0) {
            this.goToSlide(this.currentSlide - 1);
          }
        }
      };

      this.sliderEventHandlers.mousedown = (e) => {
        startX = e.clientX;
        isDragging = true;
        e.preventDefault();
      };

      // Throttle mousemove to prevent performance issues
      let mouseMoveTimeout;
      this.sliderEventHandlers.mousemove = (e) => {
        if (!isDragging) return;
        if (mouseMoveTimeout) return;
        mouseMoveTimeout = requestAnimationFrame(() => {
          currentX = e.clientX;
          mouseMoveTimeout = null;
        });
      };

      this.sliderEventHandlers.mouseup = () => {
        if (!isDragging) return;
        isDragging = false;

        const diff = startX - currentX;
        const slides = sliderTrack.querySelectorAll(".slider-slide");

        if (Math.abs(diff) > 50) {
          if (diff > 0 && this.currentSlide < slides.length - 1) {
            this.goToSlide(this.currentSlide + 1);
          } else if (diff < 0 && this.currentSlide > 0) {
            this.goToSlide(this.currentSlide - 1);
          }
        }
      };

      this.sliderEventHandlers.mouseleave = () => {
        isDragging = false;
      };
    }

    // Add event listeners only if not already attached
    if (!sliderTrack.dataset.listenersAttached) {
      sliderTrack.addEventListener(
        "touchstart",
        this.sliderEventHandlers.touchstart
      );
      sliderTrack.addEventListener(
        "touchmove",
        this.sliderEventHandlers.touchmove
      );
      sliderTrack.addEventListener(
        "touchend",
        this.sliderEventHandlers.touchend
      );
      sliderTrack.addEventListener(
        "mousedown",
        this.sliderEventHandlers.mousedown
      );
      sliderTrack.addEventListener(
        "mousemove",
        this.sliderEventHandlers.mousemove
      );
      sliderTrack.addEventListener("mouseup", this.sliderEventHandlers.mouseup);
      sliderTrack.addEventListener(
        "mouseleave",
        this.sliderEventHandlers.mouseleave
      );
      sliderTrack.dataset.listenersAttached = "true";
    }

    this.sliderInitialized = true;
  }

  goToSlide(index) {
    const sliderTrack = this.container.querySelector("[data-slider-track]");

    if (!sliderTrack) return;

    this.currentSlide = index;

    sliderTrack.style.transform = `translateX(-${index * 100}%)`;

    this.updateSliderArrows();
  }

  updateSliderArrows() {
    const prevBtn = this.container.querySelector("[data-slider-prev]");
    const nextBtn = this.container.querySelector("[data-slider-next]");
    const sliderTrack = this.container.querySelector("[data-slider-track]");

    if (!sliderTrack) return;

    const slides = sliderTrack.querySelectorAll(".slider-slide");

    if (prevBtn) {
      if (this.currentSlide === 0) {
        prevBtn.style.opacity = "0.3";
        prevBtn.style.pointerEvents = "none";
      } else {
        prevBtn.style.opacity = "1";
        prevBtn.style.pointerEvents = "auto";
      }
    }

    if (nextBtn) {
      if (this.currentSlide === slides.length - 1) {
        nextBtn.style.opacity = "0.3";
        nextBtn.style.pointerEvents = "none";
      } else {
        nextBtn.style.opacity = "1";
        nextBtn.style.pointerEvents = "auto";
      }
    }
  }

  updateProgress() {
    const progressContainer = this.container.querySelector(
      "[data-progress-dots]"
    );

    if (this.currentStep === 1) {
      if (progressContainer) {
        progressContainer.style.display = "none";
      }
    } else {
      if (progressContainer) {
        progressContainer.style.display = "block";
      }

      const dots = this.container.querySelectorAll("[data-step-dot]");
      dots.forEach((dot) => {
        const dotStep = parseInt(dot.dataset.stepNumber);

        dot.classList.remove("active", "completed");

        if (dotStep < this.currentStep) {
          dot.classList.add("completed");
        } else if (dotStep === this.currentStep) {
          dot.classList.add("active");
        }
      });
    }
  }

  async renderOrderSummary() {
    const summaryContainer = this.container.querySelector(
      "[data-order-summary]"
    );
    const totalsContainer = this.container.querySelector(
      "[data-summary-totals]"
    );
    const deliveryBullet = this.container.querySelector(
      "[data-delivery-bullet]"
    );
    if (!summaryContainer) return;

    // Get actual cart AFTER sync finishes to display real quantities
    const cart = await this.getCart();

    let html = '<div class="order-summary">';

    // Use cartState.mainProductVariantId to find variant (matches cart), fallback to selectedVariant
    const variantIdForDisplay =
      this.cartState.mainProductVariantId || this.selectedVariant?.id;
    // CRITICAL: Define variantIdToFind OUTSIDE if block so it's accessible in totals calculation
    const variantIdToFind =
      this.cartState.mainProductVariantId || this.selectedVariant?.id;
    const variantForDisplay = variantIdForDisplay
      ? this.productData.variants.find((v) => v.id === variantIdForDisplay) ||
        this.selectedVariant
      : this.selectedVariant;

    if (variantForDisplay) {
      // Get actual quantity from cart (not just cartState boolean)
      // variantIdToFind is now defined above, outside this block
      this.addDebugLog(
        "INFO",
        `Looking for main product: variant_id ${variantIdToFind} (cartState: ${this.cartState.mainProductVariantId}, selected: ${this.selectedVariant?.id}), cart has ${cart.items.length} items`
      );
      const mainProductCartItem = cart.items.find(
        (item) => item.variant_id === variantIdToFind
      );
      this.addDebugLog(
        "INFO",
        `Main product cart item found: ${!!mainProductCartItem}, variant_id match: ${
          mainProductCartItem?.variant_id
        }`
      );

      // Simple variant image lookup from map, fallback to product featured image
      // Convert variant ID to string because map keys are strings from Liquid JSON
      let variantImage =
        this.variantImageMap[String(variantIdToFind)] ||
        this.productData.featured_image;
      // Fix protocol-relative URLs (//) to https:// on the spot
      let imageUrl = "";
      if (variantImage && typeof variantImage === "string") {
        if (variantImage.startsWith("//")) {
          imageUrl = "https:" + variantImage;
        } else {
          imageUrl = variantImage;
        }
        // Only use getImageUrl for product featured_image fallback, not for map URLs (map URLs are already correct)
        if (!this.variantImageMap[String(variantIdToFind)]) {
          imageUrl = this.getImageUrl(imageUrl, 200);
        }
      }

      this.addDebugLog(
        "INFO",
        `Variant image lookup: variant_id=${variantIdToFind}, found_in_map=${!!this
          .variantImageMap[String(variantIdToFind)]}, using=${
          variantImage ? "variant_image" : "product_featured_image"
        }, url=${imageUrl}`
      );
      const mainProductQuantity = mainProductCartItem
        ? mainProductCartItem.quantity
        : 0;
      // Get line item key - Shopify cart.js uses 'key' property
      // Log full cart item to see what properties it has
      if (mainProductCartItem) {
        this.addDebugLog(
          "INFO",
          `Main product cart item full structure: ${JSON.stringify(
            mainProductCartItem
          )}`
        );
      }
      const mainProductLineItemKey =
        mainProductCartItem?.key || mainProductCartItem?.id || "";
      if (mainProductCartItem && !mainProductLineItemKey) {
        this.addDebugLog(
          "error",
          `Main product cart item found but no key/id. Available keys: ${Object.keys(
            mainProductCartItem
          ).join(", ")}`
        );
      }
      html += `
        <div class="summary-item summary-item--product" data-summary-item data-variant-id="${variantIdToFind}" data-is-main-product="true">
        <div class="summary-product-details-container">
          <div class="summary-product-image">
            ${
              imageUrl
                ? `<img src="${imageUrl}" alt="${this.productData.title}">`
                : ""
            }
          </div>
          <div class="summary-product-details">
            <h4 class="summary-product-title">${this.productData.title}</h4>
            <p class="summary-variant-info">Color: ${
              this.selectedColor ||
              variantForDisplay.option1 ||
              variantForDisplay.option2 ||
              variantForDisplay.option3 ||
              ""
            }, Shell: ${
        this.selectedShellColor ||
        variantForDisplay.option1 ||
        variantForDisplay.option2 ||
        variantForDisplay.option3 ||
        ""
      }, <strong>${
        this.selectedSmartOption ||
        variantForDisplay.option1 ||
        variantForDisplay.option2 ||
        variantForDisplay.option3 ||
        ""
      }</strong></p>
          </div>
          </div>
          <div class="summary-product-pricing">
            <div class="quantity__wrapper" data-quantity-selector>
              <button type="button" class="quantity__button quantity__button--minus" data-decrease-quantity data-line-item-key="${mainProductLineItemKey}" aria-label="Decrease quantity">&minus;</button>
              <input type="number" 
                     class="quantity__input" 
                     data-quantity-input 
                     data-update-cart="${mainProductLineItemKey}"
                     data-variant-id="${variantIdForDisplay}"
                     data-is-main-product="true"
                     min="0" 
                     max="10" 
                     value="${mainProductQuantity}" 
                     aria-label="Quantity">
              <button type="button" class="quantity__button quantity__button--plus" data-increase-quantity data-line-item-key="${mainProductLineItemKey}" aria-label="Increase quantity">+</button>
            </div>
            <p class="summary-price-discounted">${this.formatMoney(
              variantForDisplay.price
            )}</p>
          </div>
        </div>
      `;
    }

    // Display accessories from cartState JSON (which matches cart after sync)
    if (this.cartState.accessories && this.cartState.accessories.length > 0) {
      for (const accessoryState of this.cartState.accessories) {
        if (accessoryState.quantity === 0) continue;

        // Get actual quantity from cart (not just cartState)
        const accessoryCartItem = cart.items.find(
          (item) => item.variant_id === accessoryState.variantId
        );
        const quantity = accessoryCartItem
          ? accessoryCartItem.quantity
          : accessoryState.quantity;
        // Get line item key - Shopify cart.js uses 'key' property
        const accessoryLineItemKey =
          accessoryCartItem?.key || accessoryCartItem?.id || "";
        if (accessoryCartItem && !accessoryLineItemKey) {
          this.addDebugLog(
            "error",
            `Accessory cart item found but no key/id: ${JSON.stringify(
              accessoryCartItem
            )}`
          );
        }

        // Use accessoryState data (from cartState) for display - has title, price, image
        // Fallback to selectedAccessories if available (for better image quality)
        const accessoryFromSelected = this.selectedAccessories.find(
          (acc) => acc.id === accessoryState.variantId
        );
        const displayTitle =
          accessoryState.title || accessoryFromSelected?.title || "Accessory";
        const displayPrice =
          accessoryState.price || accessoryFromSelected?.price || 0;
        const displayImage =
          accessoryState.image || accessoryFromSelected?.image || "";

        const discountedPrice = displayPrice * 0.8;
        const totalDiscountedPrice = discountedPrice * quantity;
        const totalPrice = displayPrice * quantity;
        const imageUrl = displayImage
          ? this.getImageUrl(displayImage, 200)
          : "";

        html += `
          <div class="summary-item summary-item--product" data-summary-item data-variant-id="${
            accessoryState.variantId
          }" data-is-main-product="false">
            <div class="summary-product-details-container">
              <div class="summary-product-image">
                  ${
                    imageUrl
                      ? `<img src="${imageUrl}" alt="${displayTitle}">`
                      : ""
                  }
              </div>
              <div class="summary-product-details">
                  <h4 class="summary-product-title">${displayTitle}</h4>
              </div>
            </div>
            <div class="summary-product-pricing">
              <div class="quantity__wrapper" data-quantity-selector>
                <button type="button" class="quantity__button quantity__button--minus" data-decrease-quantity data-line-item-key="${accessoryLineItemKey}" aria-label="Decrease quantity">&minus;</button>
                <input type="number" 
                       class="quantity__input" 
                       data-update-cart="${accessoryLineItemKey}"
                       data-variant-id="${accessoryState.variantId}"
                       min="0" 
                       max="99"
                       value="${quantity}" 
                       aria-label="Quantity">
                <button type="button" class="quantity__button quantity__button--plus" data-increase-quantity data-line-item-key="${accessoryLineItemKey}" aria-label="Increase quantity">+</button>
              </div>
              <div class="summary-price-container">
                <p class="summary-price-discounted">${this.formatMoney(
                  totalDiscountedPrice
                )}</p>
                <p class="summary-price-full">${this.formatMoney(
                  totalPrice
                )}</p>
              </div>
            </div>
          </div>
        `;
      }
    }

    // console.log('Selected smart option:', this.selectedSmartOption);

    const smartOptionLower = this.selectedSmartOption
      ? this.selectedSmartOption.toLowerCase()
      : "";
    if (
      this.selectedSmartOption &&
      (smartOptionLower.includes("non") ||
        smartOptionLower.startsWith("no ") ||
        smartOptionLower.startsWith("no-"))
    ) {
      // Calculate dynamic upgrade price (same logic as Step 3)
      const upgradePriceHtml = this.getSmartUpgradePrice() || "$200";

      html += `
        <div class="summary-upgrade">
          <div class="summary-upgrade-container">
            <div class="summary-upgrade-icon-container">
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M21.25 2.5H8.75C7.36929 2.5 6.25 3.61929 6.25 5V25C6.25 26.3807 7.36929 27.5 8.75 27.5H21.25C22.6307 27.5 23.75 26.3807 23.75 25V5C23.75 3.61929 22.6307 2.5 21.25 2.5Z" stroke="black" stroke-opacity="0.89" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M15 22.5H15.0125" stroke="black" stroke-opacity="0.89" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            </div>
            <div class="summary-upgrade-content">
            <div class="summary-upgrade-title">Add Smart Capabilities</div>
            <span>14 sensors, alerts & more ${upgradePriceHtml}</span>
            </div>
          </div>
          <button data-upgrade-to-smart class="btn-text-add-upgrade">
            <span class="btn-text-add-upgrade-text">ADD</span>
            <span class="btn-text-added-upgrade-text" style="display: none;">
              <span>Added</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13.3333 4L6 11.3333L2.66666 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </button>
        </div>
      `;
    }

    html += "</div>";

    summaryContainer.innerHTML = html;

    // Debug: Check if main product buttons have line item keys
    const mainProductIncreaseBtn = summaryContainer.querySelector(
      "[data-increase-quantity][data-is-main-product='true'], [data-increase-quantity]"
    );
    if (mainProductIncreaseBtn) {
      const mainKey = mainProductIncreaseBtn.getAttribute("data-line-item-key");
      this.addDebugLog(
        "INFO",
        `Main product increase button lineItemKey after render: "${mainKey}"`
      );
    }

    // Attach quantity picker event listeners AFTER HTML is set
    // Small delay ensures DOM is fully ready
    setTimeout(() => {
      this.attachQuantityPickerListeners();
    }, 0);

    let subtotal = 0;
    let totalDiscounted = 0;

    // Calculate main product total using variantForDisplay (from cart) and actual quantity from cart
    // Re-find mainProductCartItem for totals calculation (it was defined earlier but may be out of scope)
    if (variantForDisplay && variantIdToFind) {
      const mainProductCartItemForTotals = cart.items.find(
        (item) => item.variant_id === variantIdToFind
      );
      if (mainProductCartItemForTotals) {
        const mainProductQuantity = mainProductCartItemForTotals.quantity;
        const mainProductTotal = variantForDisplay.price * mainProductQuantity;
        subtotal += mainProductTotal;
        totalDiscounted += mainProductTotal;
        this.addDebugLog(
          "INFO",
          `Totals: Main product quantity ${mainProductQuantity}, price ${variantForDisplay.price}, total ${mainProductTotal}`
        );
      }
    }

    // Calculate totals from cartState JSON (which matches cart after sync)
    // Use actual cart quantities, not just cartState quantities
    if (this.cartState.accessories && this.cartState.accessories.length > 0) {
      for (const accessoryState of this.cartState.accessories) {
        if (accessoryState.quantity === 0) continue;

        // Get actual quantity from cart (not just cartState)
        const accessoryCartItem = cart.items.find(
          (item) => item.variant_id === accessoryState.variantId
        );
        const quantity = accessoryCartItem
          ? accessoryCartItem.quantity
          : accessoryState.quantity;

        // Use accessoryState data (from cartState) for price, fallback to selectedAccessories
        const accessoryFromSelected = this.selectedAccessories.find(
          (acc) => acc.id === accessoryState.variantId
        );
        const accessoryPrice =
          accessoryState.price || accessoryFromSelected?.price || 0;

        const accessoryTotal = accessoryPrice * quantity;
        subtotal += accessoryTotal;
        totalDiscounted += accessoryTotal * 0.8;
        this.addDebugLog(
          "INFO",
          `Totals: Accessory ${
            accessoryState.variantId
          } quantity ${quantity}, price ${accessoryPrice}, total ${accessoryTotal}, discounted ${
            accessoryTotal * 0.8
          }`
        );
      }
    }

    this.addDebugLog(
      "INFO",
      `Totals calculated: subtotal ${subtotal}, totalDiscounted ${totalDiscounted}, savings ${
        subtotal - totalDiscounted
      }`
    );

    const savings = subtotal - totalDiscounted;

    if (totalsContainer) {
      let savingsRow = "";
      if (savings > 0) {
        savingsRow = `
          <div class="summary-total-row summary-total-savings">
            <span>Your Save</span>
            <span>-${this.formatMoney(savings)}</span>
          </div>
        `;
      }

      totalsContainer.innerHTML = `
        <div class="summary-totals">
          <div class="summary-total-row">
            <span>Subtotal</span>
            <span>${this.formatMoney(subtotal)}</span>
          </div>
          ${savingsRow}
          <div class="summary-total-row summary-total-final">
            <span>Total</span>
            <span class="totalMultiStep">${this.formatMoney(
              totalDiscounted
            )}</span>
          </div>
        </div>
      `;
    }

    // Update Affirm price display
    this.refreshAffirmPrice(totalDiscounted);

    const upgradeBtn = summaryContainer.querySelector(
      "[data-upgrade-to-smart]"
    );
    if (upgradeBtn) {
      upgradeBtn.addEventListener("click", () =>
        this.upgradeToSmart(upgradeBtn)
      );
    }

    if (deliveryBullet) {
      const deliveryText = this.getDeliveryText();
      if (deliveryText) {
        deliveryBullet.innerHTML = `
          <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 5C0 2.23858 2.23858 0 5 0H20C22.7614 0 25 2.23858 25 5V20C25 22.7614 22.7614 25 20 25H5C2.23858 25 0 22.7614 0 20V5Z" fill="#F7F7F7"/>
          <g clip-path="url(#clip0_7373_282)">
          <path d="M20 0H5C2.23858 0 0 2.23858 0 5V20C0 22.7614 2.23858 25 5 25H20C22.7614 25 25 22.7614 25 20V5C25 2.23858 22.7614 0 20 0Z" fill="#F7F7F7"/>
          <path d="M8.56104 6.9375C7.88157 6.9375 7.43896 7.56112 7.43896 8.19238V8.80566H5.94873C4.22776 8.80582 2.95666 10.487 2.95654 12.3926V15.6533C2.95664 16.3486 3.43014 17.0575 4.17139 17.0576H4.43896C4.61317 17.6402 5.15653 18.0625 5.79541 18.0625C6.43429 18.0624 6.97794 17.6403 7.15186 17.0576H12.5005C12.6746 17.6402 13.2182 18.0624 13.8569 18.0625C14.4958 18.0624 15.0394 17.6402 15.2134 17.0576H16.063C16.7423 17.0575 17.185 16.4339 17.1851 15.8027V8.19238C17.1851 7.56117 16.7423 6.93761 16.063 6.9375H8.56104ZM13.8569 16.0332C14.2119 16.0333 14.4927 16.3172 14.4927 16.6582C14.4924 16.9991 14.2117 17.2831 13.8569 17.2832C13.5022 17.283 13.2214 16.999 13.2212 16.6582C13.2212 16.3172 13.5021 16.0334 13.8569 16.0332ZM5.79541 16.0332C6.15033 16.0333 6.43113 16.3172 6.43115 16.6582C6.4309 16.9991 6.15018 17.2831 5.79541 17.2832C5.44054 17.2832 5.15992 16.9991 5.15967 16.6582C5.15969 16.3171 5.44039 16.0332 5.79541 16.0332ZM7.43896 16.2783H7.15674C6.98947 15.6852 6.44164 15.254 5.79541 15.2539C5.14908 15.2539 4.60056 15.6852 4.43311 16.2783H4.17139C4.00299 16.2782 3.73593 16.0754 3.73584 15.6533V12.3926C3.73596 10.7611 4.79989 9.58513 5.94873 9.58496H7.43896V16.2783ZM16.063 7.7168C16.1951 7.71693 16.4058 7.86519 16.4058 8.19238V15.8027C16.4057 16.1298 16.1951 16.2772 16.063 16.2773H15.2183C15.0507 15.6848 14.5028 15.254 13.8569 15.2539C13.2111 15.2541 12.6634 15.6848 12.4956 16.2773H8.21924V8.80566L8.21826 8.19238C8.21826 7.86504 8.42892 7.7168 8.56104 7.7168H16.063ZM17.9263 14.2627C17.711 14.2627 17.5357 14.4371 17.5356 14.6523C17.5356 14.8677 17.711 15.042 17.9263 15.042H20.0776C20.293 15.042 20.4673 14.8677 20.4673 14.6523C20.4672 14.4371 20.2929 14.2627 20.0776 14.2627H17.9263ZM17.9233 12.4229C17.7083 12.4232 17.5337 12.5974 17.5337 12.8125C17.5337 13.0277 17.7083 13.2018 17.9233 13.2021H20.7798C20.9951 13.2021 21.1694 13.0278 21.1694 12.8125C21.1694 12.5972 20.9951 12.4229 20.7798 12.4229H17.9233ZM17.9253 10.626C17.71 10.626 17.5356 10.8003 17.5356 11.0156C17.5357 11.2309 17.71 11.4053 17.9253 11.4053H21.6538C21.8689 11.405 22.0434 11.2308 22.0435 11.0156C22.0435 10.8004 21.8689 10.6262 21.6538 10.626H17.9253Z" fill="#333333"/>
          </g>
          <defs>
          <clipPath id="clip0_7373_282">
          <rect width="25" height="25" fill="white"/>
          </clipPath>
          </defs>
          </svg>

          ${deliveryText}
        `;
      }
    }

    // Attach quantity picker event listeners
    this.attachQuantityPickerListeners();

    // Attach click handler to Affirm purchasing power link
    const affirmLink = this.container.querySelector(
      ".affirm-purchasing-power-link"
    );
    if (affirmLink) {
      affirmLink.addEventListener("click", (e) => {
        e.preventDefault();
        const affirmTrigger = document.querySelector(".affirm-modal-trigger");
        if (affirmTrigger) {
          affirmTrigger.click();
        }
      });
    }
  }

  getDeliveryText() {
    const properties = this.getDeliveryProperties();

    if (properties["Delivery Date"]) {
      return `Estimated delivery: ${properties["Delivery Date"]}`;
    } else if (properties["Delivery Time"]) {
      return `Estimated delivery: ${properties["Delivery Time"]}`;
    }

    return null;
  }

  refreshAffirmPrice(totalInDollars) {
    // Convert dollars to cents for Affirm
    const totalInCents = Math.round(totalInDollars);

    // Find Affirm element in step 5
    const affirmElement = this.container.querySelector(
      ".affirm-as-low-as[data-page-type='product']"
    );

    if (affirmElement && totalInCents > 0) {
      // Update the data-amount attribute
      affirmElement.setAttribute("data-amount", totalInCents);

      // Refresh Affirm display
      if (typeof affirm !== "undefined" && affirm.ui) {
        // Check if Affirm is ready, otherwise wait for it
        if (affirm.ui.ready) {
          affirm.ui.ready(function () {
            affirm.ui.refresh();
          });
        } else {
          // If ready function doesn't exist, try refresh directly
          try {
            affirm.ui.refresh();
          } catch (e) {
            // Affirm might not be loaded yet, wait a bit and try again
            setTimeout(() => {
              if (
                typeof affirm !== "undefined" &&
                affirm.ui &&
                affirm.ui.refresh
              ) {
                affirm.ui.refresh();
              }
            }, 500);
          }
        }
      }
    }
  }

  async upgradeToSmart(btn = null) {
    // Show "added" state immediately when button is clicked
    if (btn) {
      const addText = btn.querySelector(".btn-text-add-upgrade-text");
      const addedText = btn.querySelector(".btn-text-added-upgrade-text");

      if (addText && addedText) {
        addText.style.display = "none";
        addedText.style.display = "flex";
        btn.classList.add("showing-added");
      }
    }

    const smartOptionInput = this.container.querySelector(
      "[data-smart-option-input]"
    );
    if (!smartOptionInput) {
      // console.error('Smart option input not found');
      return;
    }

    this.selectedSmartOption = smartOptionInput.dataset.smartValue;

    const smartVariant = this.productData.variants.find((v) => {
      const matchesColor =
        v.option1?.toLowerCase() === this.selectedColor?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedColor?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedColor?.toLowerCase();

      const matchesShell =
        v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

      const matchesSmart =
        v.option1?.toLowerCase() === this.selectedSmartOption?.toLowerCase() ||
        v.option2?.toLowerCase() === this.selectedSmartOption?.toLowerCase() ||
        v.option3?.toLowerCase() === this.selectedSmartOption?.toLowerCase();

      return matchesColor && matchesShell && matchesSmart;
    });

    if (smartVariant) {
      // Update cart: remove non-smart variant and add smart variant
      try {
        // Get current cart
        const cartResponse = await fetch("/cart.js");
        const cart = await cartResponse.json();

        // Find the non-smart variant line item
        const nonSmartLineItem = cart.items.find(
          (item) =>
            item.product_id === this.productData.id &&
            item.variant_id === this.selectedVariant.id
        );

        if (nonSmartLineItem) {
          // CRITICAL: Preserve quantity when upgrading (don't hardcode to 1)
          const quantityToPreserve = nonSmartLineItem.quantity;
          const propertiesToPreserve =
            nonSmartLineItem.properties || this.getDeliveryProperties();

          // Remove the non-smart variant
          await fetch("/cart/change.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: nonSmartLineItem.key,
              quantity: 0,
            }),
          });

          // Add the smart variant with PRESERVED quantity and properties
          await this.addToCart(
            smartVariant.id,
            quantityToPreserve,
            propertiesToPreserve
          );

          // Dispatch cart change event
          const updatedCart = await fetch("/cart.js").then((r) => r.json());
          document.dispatchEvent(
            new CustomEvent("theme:cart:change", {
              detail: { cart: updatedCart },
              bubbles: true,
            })
          );

          // CRITICAL: Update cartState with new smart variant ID and preserved quantity
          this.cartState.mainProductVariantId = smartVariant.id;
          this.cartState.mainProductProperties = propertiesToPreserve;
          this.cartState.mainProductAdded = true;
          this.addDebugLog(
            "CART",
            `Upgraded to smart: variant ${
              smartVariant.id
            }, quantity ${quantityToPreserve}, properties ${JSON.stringify(
              propertiesToPreserve
            )}`
          );
        }

        // Update selected variant first
        this.selectedVariant = smartVariant;

        // Check for base accessories and upgrade them to smart
        await this.upgradeBaseAccessoriesToSmart();

        // Re-render summary after all upgrades
        this.renderOrderSummary();

        // Revert button state after 2 seconds (find button again after re-render)
        setTimeout(() => {
          const summaryContainer = this.container.querySelector(
            "[data-order-summary]"
          );
          if (summaryContainer) {
            const upgradeBtn = summaryContainer.querySelector(
              "[data-upgrade-to-smart]"
            );
            if (upgradeBtn) {
              const addText = upgradeBtn.querySelector(
                ".btn-text-add-upgrade-text"
              );
              const addedText = upgradeBtn.querySelector(
                ".btn-text-added-upgrade-text"
              );

              if (addText && addedText) {
                addText.style.display = "inline-block";
                addedText.style.display = "none";
                upgradeBtn.classList.remove("showing-added");
              }
            }
          }
        }, 2000);
      } catch (error) {
        // console.error('Error updating cart:', error);
        alert(
          "There was an error upgrading to smart version. Please try again."
        );
        // Still update the UI even if cart update fails
        this.selectedVariant = smartVariant;
        this.renderOrderSummary();
      }
    } else {
      // console.error('Smart variant not found');
      alert("Smart version not available for this combination");
    }
  }

  async upgradeBaseAccessoriesToSmart() {
    try {
      // First check selectedAccessories array for bases
      const baseAccessories = this.selectedAccessories.filter((acc) => {
        const titleLower = (acc.title || "").toLowerCase();
        return titleLower.includes("base");
      });

      // Upgrade bases from selectedAccessories
      for (const baseAccessory of baseAccessories) {
        await this.upgradeBaseAccessoryToSmart(baseAccessory);
      }

      // Also check cart for bases (in case they're already added)
      const cartResponse = await fetch("/cart.js");
      const cart = await cartResponse.json();

      // Find base accessories in cart (check if product title contains "base")
      const baseItems = cart.items.filter((item) => {
        const titleLower = (item.product_title || "").toLowerCase();
        return (
          titleLower.includes("base") && item.product_id !== this.productData.id
        );
      });

      // Upgrade bases from cart
      for (const baseItem of baseItems) {
        await this.upgradeBaseToSmart(baseItem);
      }

      // Dispatch cart change event after all base upgrades
      const updatedCart = await fetch("/cart.js").then((r) => r.json());
      document.dispatchEvent(
        new CustomEvent("theme:cart:change", {
          detail: { cart: updatedCart },
          bubbles: true,
        })
      );

      // Re-render order summary to show updated base information
      if (this.currentStep === 5) {
        this.renderOrderSummary();
      }
    } catch (error) {
      // console.error('Error upgrading base accessories:', error);
      // Don't show error to user, just log it
    }
  }

  async upgradeBaseAccessoryToSmart(baseAccessory) {
    try {
      // Check if this is a classic base (needs upgrade)
      const titleLower = (baseAccessory.title || "").toLowerCase();
      const isClassic = titleLower.includes("classic");

      if (!isClassic) {
        return; // Not a classic base, no upgrade needed
      }

      // Check if base is already in cart
      const cartResponse = await fetch("/cart.js");
      const cart = await cartResponse.json();

      const baseCartItem = cart.items.find(
        (item) => item.variant_id === baseAccessory.id
      );

      if (baseCartItem) {
        // Base is in cart, upgrade it using cart method (same as seat upgrade)
        await this.upgradeBaseToSmart(baseCartItem);
      } else {
        // Base not in cart yet - use data-smart-base-variant-id from Liquid
        const accessoriesContainer = this.container.querySelector(
          "[data-accessories-container]"
        );

        if (!accessoriesContainer) {
          return;
        }

        // Find classic base item
        let classicBaseItem = null;
        if (baseAccessory.productHandle) {
          classicBaseItem = accessoriesContainer.querySelector(
            `[data-accessory-item][data-product-handle="${baseAccessory.productHandle}"][data-base-type="classic"]`
          );
        }
        if (!classicBaseItem && baseAccessory.productId) {
          classicBaseItem = accessoriesContainer.querySelector(
            `[data-accessory-item][data-product-id="${baseAccessory.productId}"][data-base-type="classic"]`
          );
        }

        if (!classicBaseItem) {
          return;
        }

        // Get smart variant ID from Liquid data attribute
        const smartVariantId = classicBaseItem.dataset.smartBaseVariantId;
        if (!smartVariantId) {
          return;
        }

        // Find smart base item to get price and title
        const smartBaseItem = accessoriesContainer.querySelector(
          `[data-accessory-item][data-base-type="smart"]`
        );

        let smartPrice = baseAccessory.price;
        let smartTitle = baseAccessory.title.replace(/classic/gi, "Smart");

        if (smartBaseItem) {
          // Find checkbox with matching variant ID
          const smartCheckbox = smartBaseItem.querySelector(
            `[data-accessory-checkbox][data-accessory-id="${smartVariantId}"]`
          );
          if (smartCheckbox) {
            smartPrice = parseInt(smartCheckbox.dataset.accessoryPrice);
            smartTitle = smartCheckbox.dataset.accessoryTitle;
          }
        }

        // Update selectedAccessories
        const accessoryIndex = this.selectedAccessories.findIndex(
          (acc) => acc.id === baseAccessory.id
        );
        if (accessoryIndex > -1) {
          this.selectedAccessories[accessoryIndex].id =
            parseInt(smartVariantId);
          this.selectedAccessories[accessoryIndex].price = smartPrice;
          this.selectedAccessories[accessoryIndex].title = smartTitle;
        }
      }
    } catch (error) {
      // console.error('Error upgrading base accessory:', error);
    }
  }

  async upgradeBaseToSmart(baseCartItem) {
    try {
      // Get product handle from cart item URL
      const productUrl = baseCartItem.url || "";
      const handleMatch = productUrl.match(/\/products\/([^\/\?]+)/);

      if (!handleMatch) {
        return; // Can't get handle
      }

      const productHandle = handleMatch[1];

      // Fetch product JSON
      const productResponse = await fetch(`/products/${productHandle}.js`);
      if (!productResponse.ok) {
        return; // Product not found
      }

      const baseProduct = await productResponse.json();

      // Check if this is classic base (no variants) or smart base (has variants)
      const isClassicBase =
        baseProduct.variants.length === 1 ||
        baseProduct.title.toLowerCase().includes("classic");

      let smartBaseProduct = baseProduct;
      let smartBaseVariant = null;

      if (isClassicBase) {
        // Classic base has no variants - need to fetch smart base product
        // Find smart base handle from DOM (elements exist even if display:none)
        const accessoriesContainer = document.querySelector(
          "[data-accessories-container]"
        );

        if (!accessoriesContainer) {
          return;
        }

        // Find smart base item - query all and find the one with smart base type
        const allAccessoryItems = accessoriesContainer.querySelectorAll(
          "[data-accessory-item]"
        );

        let smartBaseItem = null;
        for (const item of allAccessoryItems) {
          if (item.dataset.baseType === "smart") {
            smartBaseItem = item;
            break;
          }
        }

        if (!smartBaseItem || !smartBaseItem.dataset.productHandle) {
          return;
        }

        const smartBaseHandle = smartBaseItem.dataset.productHandle;

        // Fetch smart base product JSON
        const smartProductResponse = await fetch(
          `/products/${smartBaseHandle}.js`
        );
        if (!smartProductResponse.ok) {
          return;
        }

        smartBaseProduct = await smartProductResponse.json();
      } else {
        // Smart base - find current variant
        const currentBaseVariant = baseProduct.variants.find(
          (v) => v.id === baseCartItem.variant_id
        );

        if (!currentBaseVariant) {
          return;
        }

        // Find which option position is the smart option
        let smartOptionPosition = -1;
        for (let i = 0; i < currentBaseVariant.options.length; i++) {
          const option = (currentBaseVariant.options[i] || "").toLowerCase();
          if (
            option.includes("smart") ||
            option.includes("non") ||
            option.includes("no ")
          ) {
            smartOptionPosition = i;
            break;
          }
        }
      }

      // Get the smart option value from main product
      const smartOptionInput = this.container.querySelector(
        "[data-smart-option-input]"
      );

      if (!smartOptionInput) {
        return;
      }
      const smartValue = smartOptionInput.dataset.smartValue;

      // Get selected colors from main product
      const selectedColor = this.selectedColor || "";
      const selectedShellColor = this.selectedShellColor || "";

      // Find smart variant
      if (isClassicBase) {
        // Classic base upgrading to smart base
        // Smart base variants only have COLOR options (no smart option)
        // Match by shell color from main product - bases only have one color
        smartBaseVariant = smartBaseProduct.variants.find((v) => {
          if (!v.available) {
            return false;
          }

          // Match shell color - bases only have one color option (option1)
          const variantColor = v.option1 || "";
          const variantColorLower = variantColor.toLowerCase().trim();
          const shellColorLower = (selectedShellColor || "")
            .toLowerCase()
            .trim();

          return shellColorLower && variantColorLower === shellColorLower;
        });
      } else {
        // Smart base upgrading (has variants with smart option)
        smartBaseVariant = smartBaseProduct.variants.find((v) => {
          if (!v.available) {
            return false;
          }

          // Match smart option
          const matchesSmart =
            v.option1?.toLowerCase() === smartValue?.toLowerCase() ||
            v.option2?.toLowerCase() === smartValue?.toLowerCase() ||
            v.option3?.toLowerCase() === smartValue?.toLowerCase();

          if (!matchesSmart) {
            return false;
          }

          // Match all other options exactly
          const currentBaseVariant = baseProduct.variants.find(
            (v) => v.id === baseCartItem.variant_id
          );
          if (!currentBaseVariant) {
            return false;
          }

          let smartOptionPosition = -1;
          for (let i = 0; i < currentBaseVariant.options.length; i++) {
            const option = (currentBaseVariant.options[i] || "").toLowerCase();
            if (
              option.includes("smart") ||
              option.includes("non") ||
              option.includes("no ")
            ) {
              smartOptionPosition = i;
              break;
            }
          }

          // Match all other options exactly
          for (let i = 0; i < currentBaseVariant.options.length; i++) {
            if (i === smartOptionPosition) {
              continue; // Skip smart option position (already checked)
            }
            if (currentBaseVariant.options[i] !== v.options[i]) {
              return false;
            }
          }

          return true;
        });
      }

      if (smartBaseVariant) {
        // Remove non-smart base and add smart base
        await fetch("/cart/change.js", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: baseCartItem.key,
            quantity: 0,
          }),
        });

        // Get delivery properties for the base (use properties from cart item to preserve them)
        // Cart item properties take precedence, fallback to getting from DOM
        const baseProperties =
          baseCartItem.properties &&
          Object.keys(baseCartItem.properties).length > 0
            ? baseCartItem.properties
            : this.getAccessoryDeliveryProperties(baseCartItem.variant_id);

        // Add smart base variant with preserved properties
        await this.addToCart(
          smartBaseVariant.id,
          baseCartItem.quantity,
          baseProperties
        );

        // Update selectedAccessories array
        const accessoryIndex = this.selectedAccessories.findIndex(
          (acc) => acc.id === baseCartItem.variant_id
        );

        if (accessoryIndex > -1) {
          this.selectedAccessories[accessoryIndex].id = smartBaseVariant.id;
          this.selectedAccessories[accessoryIndex].price =
            smartBaseVariant.price;
          this.selectedAccessories[accessoryIndex].title =
            smartBaseVariant.name || smartBaseVariant.title;
          // Preserve properties for future matching
          if (!this.selectedAccessories[accessoryIndex].properties) {
            this.selectedAccessories[accessoryIndex].properties =
              baseProperties;
          }
        }

        // Update cartState JSON
        const cartStateIndex = this.cartState.accessories.findIndex(
          (acc) => acc.variantId === baseCartItem.variant_id
        );
        if (cartStateIndex > -1) {
          this.cartState.accessories[cartStateIndex].variantId =
            smartBaseVariant.id;
          this.cartState.accessories[cartStateIndex].price =
            smartBaseVariant.price;
          this.cartState.accessories[cartStateIndex].title =
            smartBaseVariant.name || smartBaseVariant.title;
        }

        // Re-render order summary if we're on step 5
        if (this.currentStep === 5) {
          await this.renderOrderSummary();
        }
      }
    } catch (error) {
      // console.error('Error upgrading base to smart:', error);
      // Don't show error, just fail silently
    }
  }

  async getCart() {
    try {
      const response = await fetch("/cart.js");
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      // console.error('Error fetching cart:', error);
      return null;
    }
  }

  isItemInCart(cart, variantId, properties = {}) {
    if (!cart || !cart.items) return false;

    return cart.items.some((item) => {
      // Check if variant ID matches
      if (item.variant_id !== variantId) return false;

      // If no properties provided, just match by variant ID
      if (!properties || Object.keys(properties).length === 0) {
        return true;
      }

      // Check if properties match
      const itemProperties = item.properties || {};
      const propertiesMatch = Object.keys(properties).every((key) => {
        return itemProperties[key] === properties[key];
      });

      return propertiesMatch;
    });
  }

  getCartItemQuantity(cart, variantId, properties = {}) {
    if (!cart || !cart.items) return 0;

    const matchingItem = this.getCartItem(cart, variantId, properties);
    return matchingItem ? matchingItem.quantity : 0;
  }

  getCartItem(cart, variantId, properties = {}) {
    if (!cart || !cart.items) return null;

    // Normalize properties - remove null/empty values for comparison
    const searchProperties = {};
    if (properties) {
      Object.keys(properties).forEach((key) => {
        if (properties[key] !== null && properties[key] !== "") {
          searchProperties[key] = properties[key];
        }
      });
    }
    const searchKeys = Object.keys(searchProperties);

    return cart.items.find((item) => {
      // Check if variant ID matches
      if (item.variant_id !== variantId) return false;

      const itemProperties = item.properties || {};
      const itemKeys = Object.keys(itemProperties).filter(
        (key) => itemProperties[key] !== null && itemProperties[key] !== ""
      );

      // If both have no properties, match by variant ID only
      if (searchKeys.length === 0 && itemKeys.length === 0) {
        return true;
      }

      // If search has no properties but item has properties, don't match
      // (we want exact match when properties are involved)
      if (searchKeys.length === 0 && itemKeys.length > 0) {
        return false;
      }

      // If search has properties but item has none, don't match
      if (searchKeys.length > 0 && itemKeys.length === 0) {
        return false;
      }

      // Both have properties - check exact match
      if (searchKeys.length !== itemKeys.length) {
        return false;
      }

      // Check all properties match
      return searchKeys.every((key) => {
        return itemProperties[key] === searchProperties[key];
      });
    });
  }

  async updateCartItemQuantity(lineItemKey, quantity) {
    try {
      const response = await fetch("/cart/change.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: lineItemKey,
          quantity: quantity,
        }),
      });

      if (response.ok) {
        const cart = await fetch("/cart.js").then((r) => r.json());
        document.dispatchEvent(
          new CustomEvent("theme:cart:change", {
            detail: { cart: cart },
            bubbles: true,
          })
        );
        return true;
      } else {
        const error = await response.json();
        // console.error('Cart update failed:', error);
        return false;
      }
    } catch (error) {
      // console.error('Error updating cart:', error);
      return false;
    }
  }

  // Initialize cartState JSON from cart on page load
  async initializeCartStateFromCart() {
    try {
      const cart = await this.getCart();
      if (!cart || !cart.items || cart.items.length === 0) {
        // Cart is empty, start with fresh state
        this.cartState = {
          mainProductAdded: false,
          mainProductVariantId: null,
          mainProductProperties: {},
          accessories: [],
        };
        return;
      }

      // Check if main product is in cart (by checking if any item matches current product)
      if (this.productData && this.productData.id) {
        const mainProductItems = cart.items.filter(
          (item) => item.product_id === this.productData.id
        );
        if (mainProductItems.length > 0) {
          // Use the first main product item (or find matching variant if we have selectedVariant)
          const mainProductItem = this.selectedVariant
            ? mainProductItems.find(
                (item) => item.variant_id === this.selectedVariant.id
              ) || mainProductItems[0]
            : mainProductItems[0];

          if (mainProductItem) {
            this.cartState.mainProductAdded = true;
            this.cartState.mainProductVariantId = mainProductItem.variant_id;
            this.cartState.mainProductProperties =
              mainProductItem.properties || {};
          }
        } else {
          // No main product in cart
          this.cartState.mainProductAdded = false;
          this.cartState.mainProductVariantId = null;
          this.cartState.mainProductProperties = {};
        }
      }

      // Find accessories (items that are NOT the main product)
      const accessoryItems = cart.items.filter(
        (item) => !this.productData || item.product_id !== this.productData.id
      );

      this.cartState.accessories = accessoryItems.map((item) => ({
        variantId: item.variant_id,
        quantity: item.quantity,
        properties: item.properties || {},
        title: item.product_title,
        price: item.price,
        image: item.image,
      }));
    } catch (error) {
      // console.error('Error initializing cart state:', error);
      // Start with empty state on error
      this.cartState = {
        mainProductAdded: false,
        mainProductVariantId: null,
        mainProductProperties: {},
        accessories: [],
      };
    }
  }

  // Update cartState JSON from selectedAccessories array
  // CRITICAL: Preserve accessories that are in cart but not in selectedAccessories (from previous sessions)
  async updateCartStateFromAccessories() {
    try {
      // Get current cart to see what accessories are actually there
      const cart = await this.getCart();
      // Find accessories in cart that are NOT the main product
      const cartAccessories = cart.items.filter(
        (item) => !this.productData || item.product_id !== this.productData.id
      );

      // Start with accessories from cart (preserve existing)
      const preservedAccessories = cartAccessories
        .filter((cartItem) => {
          // Only preserve if NOT in selectedAccessories (user hasn't interacted with it this session)
          return !this.selectedAccessories.some(
            (sel) => sel.id === cartItem.variant_id
          );
        })
        .map((item) => ({
          variantId: item.variant_id,
          quantity: item.quantity,
          properties: item.properties || {},
          title: item.product_title,
          price: item.price,
          image: item.image,
        }));

      // Add/update accessories from selectedAccessories (user interacted with these)
      const selectedAccessoriesState = this.selectedAccessories.map((acc) => ({
        variantId: acc.id,
        quantity: acc.quantity,
        properties: this.getAccessoryDeliveryProperties(acc.id),
        title: acc.title,
        price: acc.price,
        image: acc.image,
      }));

      // Merge: preserved + selected
      this.cartState.accessories = [
        ...preservedAccessories,
        ...selectedAccessoriesState,
      ];

      this.addDebugLog(
        "CART",
        `updateCartStateFromAccessories: Preserved ${preservedAccessories.length} accessories from cart, added ${selectedAccessoriesState.length} from selectedAccessories`
      );
    } catch (error) {
      // Fallback: if cart fetch fails, just use selectedAccessories
      this.cartState.accessories = this.selectedAccessories.map((acc) => ({
        variantId: acc.id,
        quantity: acc.quantity,
        properties: this.getAccessoryDeliveryProperties(acc.id),
        title: acc.title,
        price: acc.price,
        image: acc.image,
      }));
      this.addDebugLog(
        "CART",
        `updateCartStateFromAccessories: Error fetching cart, using selectedAccessories only: ${error.message}`
      );
    }

    // Update debug panel
    if (this.debugEnabled) {
      this.updateDebugPanel().catch((err) =>
        console.error("Debug panel update error:", err)
      );
    }
  }

  // Sync cart to match cartState JSON
  async syncCartToState() {
    try {
      this.addDebugLog(
        "CART",
        `syncCartToState START: cartState=${JSON.stringify(
          this.cartState
        )}, selectedVariant=${this.selectedVariant?.id}`
      );

      if (!this.selectedVariant) {
        this.addDebugLog("CART", "syncCartToState SKIP: No selectedVariant");
        return;
      }

      if (!this.selectedVariant.available) {
        alert("Selected variant is not available for purchase");
        return;
      }

      const properties = this.getDeliveryProperties();
      let cart = await this.getCart();
      this.addDebugLog(
        "CART",
        `syncCartToState: Initial cart has ${
          cart.items.length
        } items: ${JSON.stringify(
          cart.items.map((i) => ({
            variant_id: i.variant_id,
            quantity: i.quantity,
            product_id: i.product_id,
          }))
        )}`
      );

      // Only sync if cartState has been initialized (don't delete existing cart on page load)
      // CRITICAL: If cart has items but cartState is empty/not initialized, don't sync (would clear cart)
      if (
        !this.cartState ||
        (!this.cartState.hasOwnProperty("mainProductAdded") &&
          cart.items.length > 0)
      ) {
        this.addDebugLog(
          "CART",
          `syncCartToState skipped: cartState not initialized, cart has ${cart.items.length} items`
        );
        return;
      }

      // Additional safety: If cart has items but cartState says nothing is added, don't sync
      // This prevents clearing existing cart items
      if (
        cart.items.length > 0 &&
        !this.cartState.mainProductAdded &&
        this.cartState.accessories.length === 0
      ) {
        this.addDebugLog(
          "CART",
          `syncCartToState skipped: cart has items but cartState is empty (would clear cart)`
        );
        return;
      }

      // CRITICAL: Check if cart already matches cartState exactly - if so, skip entire sync
      const mainProductItemsCheck = cart.items.filter(
        (item) => this.productData && item.product_id === this.productData.id
      );
      const cartAccessoriesCheck = cart.items.filter(
        (item) => !this.productData || item.product_id !== this.productData.id
      );

      // Check main product match - preserve actual quantity, don't assume 1
      const currentMainQuantityCheck = mainProductItemsCheck.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      const mainProductMatches =
        (this.cartState.mainProductAdded &&
          mainProductItemsCheck.length > 0 &&
          mainProductItemsCheck.some(
            (item) => item.variant_id === this.cartState.mainProductVariantId
          ) &&
          currentMainQuantityCheck > 0) || // Any quantity > 0 matches, not just 1
        (!this.cartState.mainProductAdded &&
          mainProductItemsCheck.length === 0);

      // Check accessories match
      const cartAccessoryMap = new Map();
      cartAccessoriesCheck.forEach((item) => {
        const key = item.variant_id;
        cartAccessoryMap.set(
          key,
          (cartAccessoryMap.get(key) || 0) + item.quantity
        );
      });

      const stateAccessoryMap = new Map();
      this.cartState.accessories.forEach((acc) => {
        stateAccessoryMap.set(acc.variantId, acc.quantity);
      });

      const accessoriesMatch =
        cartAccessoryMap.size === stateAccessoryMap.size &&
        Array.from(cartAccessoryMap.entries()).every(
          ([variantId, quantity]) =>
            stateAccessoryMap.get(variantId) === quantity
        );

      if (mainProductMatches && accessoriesMatch) {
        this.addDebugLog(
          "CART",
          `syncCartToState SKIPPED: Cart already matches cartState exactly (main product: ${mainProductMatches}, accessories: ${accessoriesMatch})`
        );
        return;
      }

      // Sync main product - ADD selected variant if not already in cart (PRESERVE existing items)
      // E-commerce standard: If cart has variant A and user selects variant B, cart should have BOTH
      // Check ALL main product items (by product_id, not just variant_id)
      const mainProductItems = cart.items.filter(
        (item) => this.productData && item.product_id === this.productData.id
      );

      if (
        this.cartState.mainProductAdded &&
        this.cartState.mainProductVariantId
      ) {
        // Check if selected variant is already in cart
        const selectedVariantInCart = mainProductItems.find(
          (item) => item.variant_id === this.cartState.mainProductVariantId
        );

        if (!selectedVariantInCart) {
          // Selected variant NOT in cart - add it (preserve all existing items)
          const properties =
            this.cartState.mainProductProperties ||
            this.getDeliveryProperties();
          await this.addToCart(
            this.cartState.mainProductVariantId,
            1,
            properties
          );
          this.addDebugLog(
            "CART",
            `syncCartToState: Added selected variant ${this.cartState.mainProductVariantId} to cart (preserved ${mainProductItems.length} existing main product items)`
          );
          cart = await this.getCart();
        } else {
          // Selected variant already in cart - preserve it, no action needed
          this.addDebugLog(
            "CART",
            `syncCartToState: Selected variant ${this.cartState.mainProductVariantId} already in cart (quantity: ${selectedVariantInCart.quantity}), preserving all items`
          );
        }
      } else {
        this.addDebugLog(
          "CART",
          `syncCartToState: No main product to sync (mainProductAdded: ${this.cartState.mainProductAdded}, variantId: ${this.cartState.mainProductVariantId})`
        );
      }

      // Sync accessories - calculate difference and add/remove only what's needed
      cart = await this.getCart();
      for (const accessory of this.cartState.accessories) {
        const matchingCartItems = cart.items.filter(
          (item) => item.variant_id === accessory.variantId
        );
        const currentQuantity = matchingCartItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        );
        const desiredQuantity = accessory.quantity;
        const difference = desiredQuantity - currentQuantity;

        if (difference > 0) {
          // Need to add
          await this.addToCart(
            accessory.variantId,
            difference,
            accessory.properties
          );
          cart = await this.getCart();
        } else if (difference < 0) {
          // Need to remove
          let toRemove = Math.abs(difference);
          for (const item of matchingCartItems) {
            if (toRemove <= 0) break;
            const removeFromThis = Math.min(item.quantity, toRemove);
            const newQuantity = item.quantity - removeFromThis;
            await this.updateCartItemQuantity(item.key, newQuantity);
            toRemove -= removeFromThis;
          }
          cart = await this.getCart();
        }
      }

      // Remove accessories from cart that are NOT in cartState at all
      cart = await this.getCart();
      this.addDebugLog(
        "CART",
        `syncCartToState: Before removing accessories, cart has ${
          cart.items.length
        } items: ${JSON.stringify(
          cart.items.map((i) => ({
            variant_id: i.variant_id,
            quantity: i.quantity,
            product_id: i.product_id,
          }))
        )}`
      );
      const cartAccessoriesAfterSync = cart.items.filter(
        (item) => !this.productData || item.product_id !== this.productData.id
      );
      this.addDebugLog(
        "CART",
        `syncCartToState: Filtered accessories: ${
          cartAccessoriesAfterSync.length
        } items, cartState.accessories: ${JSON.stringify(
          this.cartState.accessories
        )}`
      );

      for (const cartItem of cartAccessoriesAfterSync) {
        const inState = this.cartState.accessories.find(
          (acc) => acc.variantId === cartItem.variant_id
        );
        if (!inState || inState.quantity === 0) {
          // Remove from cart
          this.addDebugLog(
            "CART",
            `syncCartToState: REMOVING accessory variant ${cartItem.variant_id} (not in cartState or quantity 0)`
          );
          await this.updateCartItemQuantity(cartItem.key, 0);
          cart = await this.getCart();
        }
      }
    } catch (error) {
      // console.error('Error syncing cart to state:', error);
      alert("There was an error updating cart. Please try again.");
    }
  }

  // Helper: Check if two property objects match
  propertiesMatch(props1, props2) {
    const keys1 = Object.keys(props1 || {}).filter(
      (k) => props1[k] !== null && props1[k] !== ""
    );
    const keys2 = Object.keys(props2 || {}).filter(
      (k) => props2[k] !== null && props2[k] !== ""
    );

    if (keys1.length === 0 && keys2.length === 0) return true;
    if (keys1.length !== keys2.length) return false;

    return keys1.every((key) => props1[key] === props2[key]);
  }

  haveAccessoriesChanged() {
    // Compare current selectedAccessories with lastSyncedAccessories
    if (this.selectedAccessories.length !== this.lastSyncedAccessories.length) {
      return true;
    }

    // Create maps for easier comparison
    const currentMap = new Map();
    this.selectedAccessories.forEach((acc) => {
      currentMap.set(acc.id, acc.quantity);
    });

    const syncedMap = new Map();
    this.lastSyncedAccessories.forEach((acc) => {
      syncedMap.set(acc.id, acc.quantity);
    });

    // Check if all IDs match and quantities match
    for (const [id, quantity] of currentMap) {
      if (!syncedMap.has(id) || syncedMap.get(id) !== quantity) {
        return true;
      }
    }

    // Check if synced has any IDs that current doesn't have
    for (const [id] of syncedMap) {
      if (!currentMap.has(id)) {
        return true;
      }
    }

    return false;
  }

  async syncAccessoriesToCart() {
    try {
      // console.log('Adding accessories to cart:', this.selectedAccessories);
      // Process accessories one by one, syncing cart quantity with selectedAccessories
      let currentCart = await this.getCart();
      for (const accessory of this.selectedAccessories) {
        // Refresh cart before checking each accessory to get latest state
        currentCart = await this.getCart();

        // Get properties from DOM for this accessory
        const accessoryProperties = this.getAccessoryDeliveryProperties(
          accessory.id
        );

        // Find cart item with matching variant_id AND properties
        // Shopify creates separate line items if properties differ, so we must match both
        const matchingCartItem = this.getCartItem(
          currentCart,
          accessory.id,
          accessoryProperties
        );

        const currentQuantity = matchingCartItem
          ? matchingCartItem.quantity
          : 0;
        const desiredQuantity = accessory.quantity;

        // Sync cart quantity to match exactly what user selected
        if (desiredQuantity === 0) {
          // If desired quantity is 0, remove from cart
          if (matchingCartItem) {
            await this.updateCartItemQuantity(matchingCartItem.key, 0);
            currentCart = await this.getCart();
          }
        } else if (currentQuantity === 0) {
          // Item not in cart with these properties, add it with desired quantity
          await this.addToCart(
            accessory.id,
            desiredQuantity,
            accessoryProperties
          );
          currentCart = await this.getCart();
        } else if (currentQuantity !== desiredQuantity) {
          // Item exists but quantity doesn't match, update it to desired quantity
          await this.updateCartItemQuantity(
            matchingCartItem.key,
            desiredQuantity
          );
          currentCart = await this.getCart();
        }
        // If quantities match exactly, do nothing
      }

      // Update snapshot after successful sync
      this.lastSyncedAccessories = JSON.parse(
        JSON.stringify(this.selectedAccessories)
      );
    } catch (error) {
      // console.error('Error adding to cart:', error);
      alert("There was an error adding items to cart. Please try again.");
    }
  }

  getDeliveryProperties() {
    const properties = {};
    const deliveryTimeInput = this.container.querySelector(
      'input[name="deliveryTime"]'
    );
    const deliveryDateInput = this.container.querySelector(
      'input[name="deliveryDate"]'
    );

    // console.log('Delivery time input:', deliveryTimeInput);
    // console.log('Delivery date input:', deliveryDateInput);

    if (deliveryDateInput && deliveryDateInput.value) {
      properties["Delivery Date"] = deliveryDateInput.value;
      // console.log('Using deliveryDate from input:', properties['Delivery Date']);
    } else if (deliveryTimeInput && deliveryTimeInput.value) {
      properties["Delivery Time"] = deliveryTimeInput.value;
      // console.log('Using deliveryTime from input:', properties['Delivery Time']);
    } else if (this.selectedVariant) {
      // console.log('Checking variant metafields:', this.selectedVariant.metafields);

      if (this.selectedVariant.metafields?.delivery_estimated_date) {
        properties["Delivery Date"] =
          this.selectedVariant.metafields.delivery_estimated_date;
        // console.log('Using delivery_estimated_date from variant metafield:', properties['Delivery Date']);
      } else if (this.productData?.metafields?.delivery_time) {
        properties["Delivery Time"] = this.productData.metafields.delivery_time;
        // console.log('Using delivery_time from product metafield:', properties['Delivery Time']);
      } else if (this.productData?.metafields?.estimated_date) {
        properties["Delivery Date"] =
          this.productData.metafields.estimated_date;
        // console.log('Using estimated_date from product metafield:', properties['Delivery Date']);
      }
    }

    // console.log('Final properties:', properties);
    return properties;
  }

  getAccessoryDeliveryProperties(variantId) {
    const properties = {};
    const checkbox = this.container.querySelector(
      `[data-accessory-id="${variantId}"]`
    );

    if (!checkbox) {
      return properties;
    }

    if (
      checkbox.dataset.variantDeliveryDate &&
      checkbox.dataset.variantDeliveryDate !== ""
    ) {
      properties["Delivery Date"] = checkbox.dataset.variantDeliveryDate;
    } else if (
      checkbox.dataset.deliveryTime &&
      checkbox.dataset.deliveryTime !== ""
    ) {
      properties["Delivery Time"] = checkbox.dataset.deliveryTime;
    } else if (
      checkbox.dataset.deliveryDate &&
      checkbox.dataset.deliveryDate !== ""
    ) {
      properties["Delivery Date"] = checkbox.dataset.deliveryDate;
    }

    return properties;
  }

  async goToCheckout() {
    window.location.href = "/checkout";
  }

  attachBannerListeners() {
    const featureItems = this.container.querySelectorAll(
      "[data-feature-modal]"
    );
    const backdrop = document.querySelector("[data-feature-backdrop]");
    const closeBtn = document.querySelector("[data-feature-close]");
    const customizeBtn = document.querySelector("[data-feature-customize]");
    const modalBody = document.querySelector("[data-feature-modal-body]");

    if (!backdrop || !modalBody) return;

    featureItems.forEach((item) => {
      item.addEventListener("click", () => {
        const featureId = item.dataset.featureModal;
        const featureDataScript = document.querySelector(
          `[data-feature-data="${featureId}"]`
        );

        if (featureDataScript) {
          try {
            const featureData = JSON.parse(featureDataScript.textContent);

            modalBody.innerHTML = `
            <button type="button" class="feature-modal-close" data-feature-close>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <div class="feature-modal-fixed-height">
             <div class="feature-modal-body-dynamic-content">
              ${
                featureData.image
                  ? `<img src="${featureData.image}" alt="${featureData.title}" class="feature-modal-body-dynamic-content-image">`
                  : ""
              }
              <div class="feature-modal-body-dynamic-content-text">
              <h3>${featureData.title}</h3>
              <p>${featureData.description}</p>
              <div>
              </div>
              </div>
            `;

            backdrop.style.display = "flex";
            document.body.style.overflow = "hidden";

            const newCloseBtn = modalBody.querySelector("[data-feature-close]");
            if (newCloseBtn) {
              newCloseBtn.addEventListener("click", () => {
                backdrop.style.display = "none";
                document.body.style.overflow = "";
              });
            }
          } catch (error) {
            // console.error('Error loading feature data:', error);
          }
        }
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        backdrop.style.display = "none";
        document.body.style.overflow = "";
      });
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.style.display = "none";
        document.body.style.overflow = "";
      }
    });

    if (customizeBtn) {
      customizeBtn.addEventListener("click", () => {
        backdrop.style.display = "none";
        document.body.style.overflow = "";
        // Hide all sections except product section
        this.hideAllSectionsExceptProduct();
        // Trigger the main customize button - but prevent recursion by checking if already hidden
        const customizeBtnMain = this.container.querySelector(
          "[data-customize-btn]"
        );
        if (customizeBtnMain && !this.sectionsHidden) {
          customizeBtnMain.click();
        } else if (customizeBtnMain) {
          // Sections already hidden, just show step 2
          this.showStep(2);
        }
      });
    }
  }

  hideAllSectionsExceptProduct() {
    // Prevent multiple calls
    if (this.sectionsHidden) {
      return;
    }

    // Find the product section (contains the multistep container)
    const productSection =
      this.container.closest("[data-section-id]") ||
      this.container.closest(".shopify-section") ||
      this.container.closest('[id^="shopify-section-"]');

    if (!productSection) {
      // console.warn('Product section not found');
      return;
    }

    const productSectionId =
      productSection.id || productSection.getAttribute("data-section-id");

    // Find all sections on the page - including app sections
    // Use multiple selectors to catch all section types
    const selectors = [
      "[data-section-id]",
      ".shopify-section",
      '[id^="shopify-section-"]',
    ];

    const allSectionsSet = new Set();
    selectors.forEach((selector) => {
      document
        .querySelectorAll(selector)
        .forEach((el) => allSectionsSet.add(el));
    });

    // Hide all sections except the product section
    allSectionsSet.forEach((section) => {
      const sectionId = section.id || section.getAttribute("data-section-id");

      // Skip if it's the product section or contains the product section
      if (
        section === productSection ||
        section.contains(productSection) ||
        sectionId === productSectionId
      ) {
        return;
      }

      // Store original display style for potential restoration (before hiding)
      if (!section.dataset.originalDisplay) {
        const computedStyle = window.getComputedStyle(section);
        section.dataset.originalDisplay = computedStyle.display || "";
      }
      section.style.display = "none";
    });

    // Hide accessibility widget and chat widget
    const accessiblyWidget = document.querySelector(
      "#accessiblyAppWidgetButton"
    );
    if (accessiblyWidget) {
      if (!accessiblyWidget.dataset.originalDisplay) {
        const computedStyle = window.getComputedStyle(accessiblyWidget);
        accessiblyWidget.dataset.originalDisplay = computedStyle.display || "";
      }
      accessiblyWidget.style.display = "none";
    }

    const tidioChat = document.querySelector("#tidio-chat");
    if (tidioChat) {
      if (!tidioChat.dataset.originalDisplay) {
        const computedStyle = window.getComputedStyle(tidioChat);
        tidioChat.dataset.originalDisplay = computedStyle.display || "";
      }
      tidioChat.style.display = "none";
    }

    // Mark as hidden to prevent recursive calls
    this.sectionsHidden = true;

    // Add class to body for styling purposes
    document.body.classList.add("multistep-customize-mode");

    // Scroll to product section
    productSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  restoreAllSections() {
    if (!this.sectionsHidden) {
      return;
    }

    // Find all sections that were hidden
    const selectors = [
      "[data-section-id]",
      ".shopify-section",
      '[id^="shopify-section-"]',
    ];

    const allSectionsSet = new Set();
    selectors.forEach((selector) => {
      document
        .querySelectorAll(selector)
        .forEach((el) => allSectionsSet.add(el));
    });

    // Restore original display styles
    allSectionsSet.forEach((section) => {
      if (section.dataset.originalDisplay !== undefined) {
        section.style.display = section.dataset.originalDisplay;
        delete section.dataset.originalDisplay;
      }
    });

    // Restore accessibility widget and chat widget
    const accessiblyWidget = document.querySelector(
      "#accessiblyAppWidgetButton"
    );
    if (
      accessiblyWidget &&
      accessiblyWidget.dataset.originalDisplay !== undefined
    ) {
      accessiblyWidget.style.display = accessiblyWidget.dataset.originalDisplay;
      delete accessiblyWidget.dataset.originalDisplay;
    }

    const tidioChat = document.querySelector("#tidio-chat");
    if (tidioChat && tidioChat.dataset.originalDisplay !== undefined) {
      tidioChat.style.display = tidioChat.dataset.originalDisplay;
      delete tidioChat.dataset.originalDisplay;
    }

    // Remove fullscreen class
    document.body.classList.remove("multistep-customize-mode");

    // Reset flag
    this.sectionsHidden = false;
  }

  // Debug Panel Methods
  initDebugPanel() {
    // Check if debug is enabled via URL parameter or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get("debug");
    const debugStorage = localStorage.getItem("multistep_debug");

    this.debugEnabled = debugParam === "true" || debugStorage === "true";

    if (!this.debugEnabled) {
      return;
    }

    // Wait for body to be ready
    if (!document.body) {
      setTimeout(() => this.initDebugPanel(), 100);
      return;
    }

    // Create debug panel HTML
    const debugPanel = document.createElement("div");
    debugPanel.id = "multistep-debug-panel";
    debugPanel.innerHTML = `
      <div class="debug-panel-header">
        <h3>Multistep Debug Panel</h3>
        <button class="debug-copy" data-debug-copy title="Copy all debug data">Copy</button>
        <button class="debug-toggle" data-debug-toggle>Collapse</button>
        <button class="debug-close" data-debug-close>×</button>
      </div>
      <div class="debug-panel-content" data-debug-content>
        <div class="debug-section">
          <h4>Current Step</h4>
          <div data-debug-step>1</div>
        </div>
        <div class="debug-section">
          <h4>Step Navigation History</h4>
          <pre data-debug-stephistory></pre>
        </div>
        <div class="debug-section">
          <h4>cartState JSON</h4>
          <pre data-debug-cartstate></pre>
        </div>
        <div class="debug-section">
          <h4>selectedAccessories</h4>
          <pre data-debug-selectedaccessories></pre>
        </div>
        <div class="debug-section">
          <h4>Current Cart</h4>
          <pre data-debug-cart></pre>
        </div>
        <div class="debug-section">
          <h4>Selected Variant</h4>
          <pre data-debug-variant></pre>
        </div>
        <div class="debug-section">
          <h4>Variant Image Map Debug</h4>
          <pre data-debug-variantimage></pre>
        </div>
        <div class="debug-section">
          <h4>Event Log</h4>
          <pre data-debug-events style="max-height: 150px;"></pre>
        </div>
      </div>
    `;
    document.body.appendChild(debugPanel);

    // Add debug panel CSS
    if (!document.getElementById("multistep-debug-styles")) {
      const style = document.createElement("style");
      style.id = "multistep-debug-styles";
      style.textContent = `
        #multistep-debug-panel {
          position: fixed;
          top: 20px;
          left: 20px;
          width: 400px;
          max-height: 80vh;
          background: #1a1a1a;
          color: #fff;
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
          z-index: 9999999999 !important;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .debug-panel-header {
          background: #2a2a2a;
          padding: 10px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #444;
        }
        .debug-panel-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: bold;
        }
        .debug-toggle, .debug-close, .debug-copy {
          background: #444;
          color: #fff;
          border: none;
          padding: 5px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          margin-left: 5px;
        }
        .debug-toggle:hover, .debug-close:hover, .debug-copy:hover {
          background: #555;
        }
        .debug-copy {
          background: #4a9eff;
        }
        .debug-copy:hover {
          background: #3a8eef;
        }
        .debug-panel-content {
          padding: 15px;
          overflow-y: auto;
          flex: 1;
        }
        .debug-panel-content.collapsed {
          display: none;
        }
        .debug-section {
          margin-bottom: 20px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }
        .debug-section:last-child {
          border-bottom: none;
        }
        .debug-section h4 {
          margin: 0 0 10px 0;
          font-size: 13px;
          color: #4a9eff;
        }
        .debug-section pre {
          margin: 0;
          padding: 10px;
          background: #0a0a0a;
          border-radius: 4px;
          overflow-x: auto;
          white-space: pre-wrap;
          word-wrap: break-word;
          font-size: 11px;
          line-height: 1.4;
          max-height: 200px;
          overflow-y: auto;
        }
        .debug-section div[data-debug-step] {
          padding: 10px;
          background: #0a0a0a;
          border-radius: 4px;
          font-size: 14px;
          font-weight: bold;
        }
      `;
      document.head.appendChild(style);
    }

    // Attach event listeners
    debugPanel
      .querySelector("[data-debug-toggle]")
      .addEventListener("click", () => {
        const content = debugPanel.querySelector("[data-debug-content]");
        const toggle = debugPanel.querySelector("[data-debug-toggle]");
        content.classList.toggle("collapsed");
        toggle.textContent = content.classList.contains("collapsed")
          ? "Expand"
          : "Collapse";
      });

    debugPanel
      .querySelector("[data-debug-close]")
      .addEventListener("click", () => {
        localStorage.setItem("multistep_debug", "false");
        debugPanel.remove();
        this.debugEnabled = false;
      });

    debugPanel
      .querySelector("[data-debug-copy]")
      .addEventListener("click", async () => {
        await this.copyDebugData();
      });

    // Initial update
    this.updateDebugPanel().catch((err) =>
      console.error("Debug panel update error:", err)
    );

    // Update every 500ms
    this.debugInterval = setInterval(() => {
      if (this.debugEnabled) {
        this.updateDebugPanel().catch((err) =>
          console.error("Debug panel update error:", err)
        );
      }
    }, 500);
  }

  async updateDebugPanel() {
    try {
      if (!this.debugEnabled) {
        return;
      }

      const panel = document.getElementById("multistep-debug-panel");
      if (!panel) {
        return;
      }

      // Update step
      const stepEl = panel.querySelector("[data-debug-step]");
      if (stepEl) {
        stepEl.textContent = this.currentStep;
      }

      // Update step history
      const stepHistoryEl = panel.querySelector("[data-debug-stephistory]");
      if (stepHistoryEl) {
        try {
          const historySlice = this.stepHistory.slice(-20); // Show last 20 steps
          const historyText = historySlice
            .map((h, idx) => {
              const stepNum = Math.max(
                1,
                this.stepHistory.length - 20 + idx + 1
              );
              return `${stepNum}. ${
                h.timestamp.split("T")[1].split(".")[0]
              } | ${h.action} | Step ${h.from} → Step ${h.to}`;
            })
            .join("\n");
          stepHistoryEl.textContent = historyText || "No navigation yet";
        } catch (err) {
          console.error("Error updating step history:", err);
          stepHistoryEl.textContent = "Error displaying history";
        }
      }

      // Update cartState
      const cartStateEl = panel.querySelector("[data-debug-cartstate]");
      if (cartStateEl) {
        cartStateEl.textContent = JSON.stringify(this.cartState, null, 2);
      }

      // Update selectedAccessories
      const selectedAccessoriesEl = panel.querySelector(
        "[data-debug-selectedaccessories]"
      );
      if (selectedAccessoriesEl) {
        selectedAccessoriesEl.textContent = JSON.stringify(
          this.selectedAccessories,
          null,
          2
        );
      }

      // Update current cart
      const cartEl = panel.querySelector("[data-debug-cart]");
      if (cartEl) {
        const cart = await this.getCart();
        if (cart) {
          cartEl.textContent = JSON.stringify(
            {
              item_count: cart.item_count,
              items: cart.items.map((item) => ({
                variant_id: item.variant_id,
                quantity: item.quantity,
                properties: item.properties,
                title: item.product_title,
              })),
            },
            null,
            2
          );
        } else {
          cartEl.textContent = "Cart is empty or error fetching";
        }
      }

      // Update selected variant
      const variantEl = panel.querySelector("[data-debug-variant]");
      if (variantEl) {
        if (this.selectedVariant) {
          variantEl.textContent = JSON.stringify(
            {
              id: this.selectedVariant.id,
              title: this.selectedVariant.title,
              price: this.selectedVariant.price,
              available: this.selectedVariant.available,
            },
            null,
            2
          );
        } else {
          variantEl.textContent = "No variant selected";
        }
      }

      // Update variant image map debug
      const variantImageEl = panel.querySelector("[data-debug-variantimage]");
      if (variantImageEl) {
        const variantIdToLookup =
          this.cartState.mainProductVariantId || this.selectedVariant?.id;
        const imageFromMap = variantIdToLookup
          ? this.variantImageMap[String(variantIdToLookup)]
          : null;
        let normalizedImage = imageFromMap;
        if (
          normalizedImage &&
          typeof normalizedImage === "string" &&
          normalizedImage.startsWith("//")
        ) {
          normalizedImage = "https:" + normalizedImage;
        }
        variantImageEl.textContent = JSON.stringify(
          {
            map_size: Object.keys(this.variantImageMap).length,
            variant_id_lookup: variantIdToLookup,
            variant_id_type: typeof variantIdToLookup,
            found_in_map: !!imageFromMap,
            image_from_map: imageFromMap,
            image_normalized: normalizedImage,
            map_has_string_key: variantIdToLookup
              ? `"${variantIdToLookup}"` in this.variantImageMap
              : false,
            map_has_number_key: variantIdToLookup
              ? variantIdToLookup in this.variantImageMap
              : false,
            sample_map_keys: Object.keys(this.variantImageMap).slice(0, 3),
          },
          null,
          2
        );
      }

      // Update event log
      const eventsEl = panel.querySelector("[data-debug-events]");
      if (eventsEl) {
        const logText = this.debugEventLog
          .slice(-30) // Show last 30 events
          .map((entry) => {
            const time = entry.timestamp.split("T")[1].split(".")[0];
            return `[${time}] ${entry.type}: ${entry.message}`;
          })
          .join("\n");
        eventsEl.textContent = logText || "No events yet";
      }
    } catch (error) {
      console.error("Error updating debug panel:", error);
    }
  }

  addDebugLog(type, message) {
    if (!this.debugEnabled) return;

    this.debugEventLog.push({
      timestamp: new Date().toISOString(),
      type: type,
      message: message,
    });

    // Keep only last N entries
    if (this.debugEventLog.length > this.maxDebugLogEntries) {
      this.debugEventLog.shift();
    }
  }

  async copyDebugData() {
    const cart = await this.getCart();
    const debugData = {
      timestamp: new Date().toISOString(),
      currentStep: this.currentStep,
      stepHistory: this.stepHistory,
      cartState: this.cartState,
      selectedAccessories: this.selectedAccessories,
      selectedVariant: this.selectedVariant
        ? {
            id: this.selectedVariant.id,
            title: this.selectedVariant.title,
            price: this.selectedVariant.price,
            available: this.selectedVariant.available,
          }
        : null,
      currentCart: cart
        ? {
            item_count: cart.item_count,
            items: cart.items.map((item) => ({
              variant_id: item.variant_id,
              quantity: item.quantity,
              properties: item.properties,
              title: item.product_title,
            })),
          }
        : null,
    };

    const jsonString = JSON.stringify(debugData, null, 2);

    try {
      await navigator.clipboard.writeText(jsonString);
      const copyBtn = document.querySelector("[data-debug-copy]");
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        copyBtn.style.background = "#4caf50";
        setTimeout(() => {
          copyBtn.textContent = originalText;
          copyBtn.style.background = "#4a9eff";
        }, 2000);
      }
      this.addDebugLog("INFO", "Debug data copied to clipboard");
    } catch (err) {
      this.addDebugLog("error", `Failed to copy debug data: ${err.message}`);
      // Fallback: show in alert
      alert("Copy failed. Check debug panel for data.");
      this.addDebugLog("INFO", `Debug Data: ${jsonString}`);
    }
  }

  attachQuantityPickerListeners() {
    const summaryContainer = this.container.querySelector(
      "[data-order-summary]"
    );
    if (!summaryContainer) return;

    // Input change handler (like theme's initInputs) - uses line item key
    summaryContainer.querySelectorAll("[data-update-cart]").forEach((input) => {
      // Prevent duplicate listeners
      if (input.dataset.listenerAttached) return;
      input.dataset.listenerAttached = "true";

      const lineItemKey = input.getAttribute("data-update-cart");
      if (!lineItemKey) return;

      input.addEventListener("change", async (e) => {
        // Skip if this was a programmatic update (from button click)
        if (e.target.dataset.programmaticUpdate) return;

        const quantity = parseInt(e.target.value, 10) || 0;
        this.addDebugLog(
          "QTY",
          `Input change: lineItemKey ${lineItemKey}, quantity ${quantity}`
        );
        await this.updateCartItemQuantityDirect(lineItemKey, quantity);
        await this.refreshSummaryAfterQuantityChange();
      });
    });

    // Decrease button (like theme's approach)
    summaryContainer
      .querySelectorAll("[data-decrease-quantity]")
      .forEach((btn) => {
        // Prevent duplicate listeners
        if (btn.dataset.listenerAttached) return;
        btn.dataset.listenerAttached = "true";

        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const lineItemKey = btn.getAttribute("data-line-item-key");
          this.addDebugLog(
            "QTY",
            `Decrease button clicked, lineItemKey: "${lineItemKey}"`
          );
          if (!lineItemKey) {
            this.addDebugLog(
              "error",
              `Decrease button has no lineItemKey. Button HTML: ${btn.outerHTML}`
            );
            return;
          }

          const input = btn.parentElement.querySelector("[data-update-cart]");
          if (!input) {
            this.addDebugLog(
              "error",
              `No input found for lineItemKey ${lineItemKey}`
            );
            return;
          }

          const currentQty = parseInt(input.value, 10) || 0;
          const newQty = Math.max(parseInt(input.min) || 0, currentQty - 1);
          // Set flag to prevent input change event from firing
          input.dataset.programmaticUpdate = "true";
          input.value = newQty;
          delete input.dataset.programmaticUpdate;
          this.addDebugLog(
            "QTY",
            `Decrease: lineItemKey ${lineItemKey}, ${currentQty} -> ${newQty}`
          );
          await this.updateCartItemQuantityDirect(lineItemKey, newQty);
          await this.refreshSummaryAfterQuantityChange();
        });
      });

    // Increase button (like theme's approach)
    summaryContainer
      .querySelectorAll("[data-increase-quantity]")
      .forEach((btn) => {
        // Prevent duplicate listeners
        if (btn.dataset.listenerAttached) return;
        btn.dataset.listenerAttached = "true";

        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const lineItemKey = btn.getAttribute("data-line-item-key");
          this.addDebugLog(
            "QTY",
            `Increase button clicked, lineItemKey: "${lineItemKey}"`
          );
          if (!lineItemKey) {
            this.addDebugLog(
              "error",
              `Increase button has no lineItemKey. Button HTML: ${btn.outerHTML}`
            );
            return;
          }

          const input = btn.parentElement.querySelector("[data-update-cart]");
          if (!input) {
            this.addDebugLog(
              "error",
              `No input found for lineItemKey ${lineItemKey}`
            );
            return;
          }

          const currentQty = parseInt(input.value, 10) || 0;
          const maxQty = parseInt(input.max) || 99;
          const newQty = Math.min(maxQty, currentQty + 1);

          // If already at max quantity, don't update (prevents unnecessary API calls)
          if (currentQty >= maxQty) {
            this.addDebugLog(
              "QTY",
              `Increase blocked: Already at max quantity ${maxQty} for lineItemKey ${lineItemKey}`
            );
            return;
          }

          // Set flag to prevent input change event from firing
          input.dataset.programmaticUpdate = "true";
          input.value = newQty;
          delete input.dataset.programmaticUpdate;
          this.addDebugLog(
            "QTY",
            `Increase: lineItemKey ${lineItemKey}, ${currentQty} -> ${newQty}`
          );
          await this.updateCartItemQuantityDirect(lineItemKey, newQty);
          await this.refreshSummaryAfterQuantityChange();
        });
      });
  }

  // Direct cart update using line item key (like theme's updateCart)
  async updateCartItemQuantityDirect(lineItemKey, quantity) {
    try {
      const response = await fetch("/cart/change.js", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: lineItemKey,
          quantity: quantity,
        }),
      });

      if (response.ok) {
        const cart = await response.json();
        this.addDebugLog(
          "CART",
          `Cart updated: lineItemKey ${lineItemKey}, quantity ${quantity}`
        );

        // Fire cart change event (like theme does)
        document.dispatchEvent(
          new CustomEvent("theme:cart:change", {
            detail: { cart: cart },
            bubbles: true,
          })
        );
        return true;
      } else {
        const error = await response.json();
        this.addDebugLog(
          "error",
          `Cart update failed: ${JSON.stringify(error)}`
        );
        return false;
      }
    } catch (error) {
      this.addDebugLog("error", `Error updating cart: ${error.message}`, error);
      return false;
    }
  }

  // Refresh summary and update cartState after quantity change
  async refreshSummaryAfterQuantityChange() {
    // Refresh cartState from actual cart
    await this.initializeCartStateFromCart();

    // Update selectedAccessories quantities to match cart
    const cart = await this.getCart();
    for (const cartItem of cart.items) {
      if (this.productData && cartItem.product_id === this.productData.id) {
        // Main product - handled by cartState
        continue;
      }

      // Accessory - update selectedAccessories
      const accessory = this.selectedAccessories.find(
        (acc) => acc.id === cartItem.variant_id
      );
      if (accessory) {
        accessory.quantity = cartItem.quantity;
      }
    }

    // Update cartState from selectedAccessories
    this.updateCartStateFromAccessories();

    // Re-render summary
    await this.renderOrderSummary();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const multiStepContainer = document.querySelector(
    "[data-multistep-container]"
  );
  if (multiStepContainer) {
    new ProductMultiStep(multiStepContainer);
  }
});
