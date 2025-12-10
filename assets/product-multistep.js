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

    this.init();
  }

  init() {
    this.loadProductData();
    this.attachEventListeners();
    this.attachBannerListeners();

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

    this.showStep(initialStep);
    this.currentSlide = 0;
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

    const checkoutBtn = this.container.querySelector("[data-checkout-btn]");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", () => this.goToCheckout());
    }

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
      const addText = btn.querySelector(".btn-text-add");
      const addedText = btn.querySelector(".btn-text-added");

      btn.disabled = true;

      if (addText && addedText) {
        addText.style.display = "none";
        addedText.style.display = "flex";
        btn.classList.add("showing-added");
      }

      await this.addAllToCart();

      setTimeout(() => {
        if (addText && addedText) {
          addText.style.display = "inline-block";
          addedText.style.display = "none";
          btn.classList.remove("showing-added");
        }
        btn.disabled = false;
        this.showStep(nextStep);
      }, 2000);
    } else {
      this.showStep(nextStep);
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
    }
  }

  updateColorAvailability() {
    if (!this.productData || !this.selectedShellColor) return;

    const colorInputs = this.container.querySelectorAll('input[name="color"]');

    colorInputs.forEach((input) => {
      const color = input.value;

      const availableVariant = this.productData.variants.find((v) => {
        const matchesShell =
          v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
          v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
          v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

        const matchesColor =
          v.option1?.toLowerCase() === color?.toLowerCase() ||
          v.option2?.toLowerCase() === color?.toLowerCase() ||
          v.option3?.toLowerCase() === color?.toLowerCase();

        return matchesShell && matchesColor && v.available;
      });

      const swatchWrapper = input.closest(".swatch-option");
      if (swatchWrapper) {
        let textBelow = swatchWrapper.querySelector(".swatch-text-below");
        let soldOutDiv = swatchWrapper.querySelector(".swatch-sold-out-fabric");

        if (!availableVariant) {
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
        // console.log('Added to cart successfully:', result);
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
        // console.error('Cart add failed:', error);
        return false;
      }
    } catch (error) {
      // console.error('Error adding to cart:', error);
      return false;
    }
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
        option.addEventListener("change", (e) => {
          this.updateAccessoryVariant(item);
          this.updateAccessoryImage(item, e.target);
        });
      });

      if (checkbox) {
        checkbox.addEventListener("change", (e) => {
          const variantId = parseInt(e.target.dataset.accessoryId);
          const accessoryTitle = e.target.dataset.accessoryTitle;
          const accessoryPrice = parseInt(e.target.dataset.accessoryPrice);
          const accessoryImage =
            item.querySelector("[data-accessory-image]")?.src || "";

          if (e.target.checked) {
            this.addAccessory(
              variantId,
              accessoryTitle,
              accessoryPrice,
              accessoryImage
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

    const priceEl = item.querySelector(".accessory-item__price");
    if (priceEl) {
      const wasChecked = checkbox.checked;
      const oldVariantId = parseInt(checkbox.dataset.accessoryId);

      if (wasChecked) {
        this.removeAccessory(oldVariantId);
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

  addAccessory(variantId, title, price, image) {
    // console.log('Adding accessory:', variantId, title);
    // console.log('Current accessories:', this.selectedAccessories);
    const existing = this.selectedAccessories.find(
      (acc) => acc.id === variantId
    );
    if (!existing) {
      this.selectedAccessories.push({
        id: variantId,
        title: title,
        price: price,
        image: image,
        quantity: 1,
      });
      // console.log('Accessory added. Total accessories:', this.selectedAccessories.length);
    } else {
      existing.quantity++;
      // console.log('Accessory quantity increased to:', existing.quantity);
    }
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
  }

  showStep(stepNumber) {
    // console.log('=== Show Step Called ===', stepNumber);
    this.currentStep = stepNumber;

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
    }

    window.scrollTo(0, 0);

    const mainContent = document.querySelector("#MainContent");
    if (mainContent) {
      mainContent.scrollTo(0, 0);
    }

    this.updateProgress();

    if (stepNumber === 2) {
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        this.initializeSlider();
      });
    }

    if (stepNumber === 4) {
      this.attachAccessoryListeners();
    }

    if (stepNumber === 5) {
      this.renderOrderSummary();
    }
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

  renderOrderSummary() {
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

    let html = '<div class="order-summary">';

    if (this.selectedVariant) {
      const variantImage =
        this.selectedVariant.featured_image?.src ||
        this.productData.featured_image;
      const imageUrl = variantImage ? this.getImageUrl(variantImage, 200) : "";

      html += `
        <div class="summary-item summary-item--product">
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
              this.selectedColor
            }, Shell: ${this.selectedShellColor}, ${
        this.selectedSmartOption
      }</p>
          </div>
          </div>
          <div class="summary-product-pricing">
            <p class="summary-price-discounted">${this.formatMoney(
              this.selectedVariant.price
            )}</p>
          </div>
        </div>
      `;
    }

    if (this.selectedAccessories.length > 0) {
      this.selectedAccessories.forEach((accessory) => {
        const discountedPrice = accessory.price * 0.8;
        const totalDiscountedPrice = discountedPrice * accessory.quantity;
        const totalPrice = accessory.price * accessory.quantity;
        const imageUrl = accessory.image
          ? this.getImageUrl(accessory.image, 200)
          : "";

        html += `
          <div class="summary-item summary-item--product">
            <div class="summary-product-details-container">
              <div class="summary-product-image">
                ${
                  imageUrl
                    ? `<img src="${imageUrl}" alt="${accessory.title}">`
                    : ""
                }
              </div>
              <div class="summary-product-details">
                <h4 class="summary-product-title">${accessory.title}${
          accessory.quantity > 1 ? ` x${accessory.quantity}` : ""
        }</h4>
              </div>
            </div>
            <div class="summary-product-pricing">
              <p class="summary-price-discounted">${this.formatMoney(
                totalDiscountedPrice
              )}</p>
              <p class="summary-price-full">${this.formatMoney(totalPrice)}</p>
            </div>
          </div>
        `;
      });
    }

    // console.log('Selected smart option:', this.selectedSmartOption);

    if (
      this.selectedSmartOption &&
      this.selectedSmartOption.toLowerCase().includes("non")
    ) {
      html += `
        <div class="summary-upgrade">
          <div class="summary-upgrade-container">
            <div class="summary-upgrade-icon-container">
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

            </div>
            <div class="summary-upgrade-content">
            <div class="summary-upgrade-title">Add Smart Capabilities</div>
            <span>14 sensors, alerts & more $200</span>
            </div>
          </div>
          <button data-upgrade-to-smart class="btn-text-add-upgrade">ADD</button>
        </div>
      `;
    }

    html += "</div>";

    summaryContainer.innerHTML = html;

    let subtotal = 0;
    let totalDiscounted = 0;

    if (this.selectedVariant) {
      subtotal += this.selectedVariant.price;
      totalDiscounted += this.selectedVariant.price;
    }

    this.selectedAccessories.forEach((accessory) => {
      const accessoryTotal = accessory.price * accessory.quantity;
      subtotal += accessoryTotal;
      totalDiscounted += accessoryTotal * 0.8;
    });

    const savings = subtotal - totalDiscounted;

    if (totalsContainer) {
      totalsContainer.innerHTML = `
        <div class="summary-totals">
          <div class="summary-total-row">
            <span>Subtotal</span>
            <span>${this.formatMoney(subtotal)}</span>
          </div>
          <div class="summary-total-row summary-total-savings">
            <span>Your Save</span>
            <span>-${this.formatMoney(savings)}</span>
          </div>
          <div class="summary-total-row summary-total-final">
            <span>Total</span>
            <span class="totalMultiStep">${this.formatMoney(
              totalDiscounted
            )}</span>
          </div>
        </div>
      `;
    }

    const upgradeBtn = summaryContainer.querySelector(
      "[data-upgrade-to-smart]"
    );
    if (upgradeBtn) {
      upgradeBtn.addEventListener("click", () => this.upgradeToSmart());
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

    // Update Affirm widget amount and setup trigger
    this.updateAffirmWidget(totalDiscounted);
  }

  updateAffirmWidget(totalAmount) {
    // Find existing Affirm widget on the page
    const affirmWidget = document.querySelector(".affirm-as-low-as");

    if (affirmWidget) {
      // Update data-amount to total order amount in cents
      const amountInCents = Math.round(totalAmount * 100);
      affirmWidget.setAttribute("data-amount", amountInCents);

      // Find the modal trigger link within the widget
      const affirmTrigger = affirmWidget.querySelector(".affirm-modal-trigger");

      // Setup click handler for our custom link
      const affirmBullet = this.container.querySelector("[data-affirm-bullet]");
      const affirmLink = affirmBullet?.querySelector("[data-affirm-trigger]");

      if (affirmLink && affirmTrigger) {
        // Remove any existing listener to prevent duplicates
        const newLink = affirmLink.cloneNode(true);
        affirmLink.parentNode.replaceChild(newLink, affirmLink);

        newLink.addEventListener("click", (e) => {
          e.preventDefault();
          // Trigger the existing Affirm modal trigger
          affirmTrigger.click();
        });
      }
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

  upgradeToSmart() {
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
      this.selectedVariant = smartVariant;
      this.renderOrderSummary();
    } else {
      // console.error('Smart variant not found');
      alert("Smart version not available for this combination");
    }
  }

  async addAllToCart() {
    try {
      if (!this.selectedVariant) {
        // console.error('No variant selected');
        alert("Please complete all steps before checkout");
        return;
      }

      // console.log('Adding main product to cart:', this.selectedVariant);
      // console.log('Variant available:', this.selectedVariant.available);

      if (!this.selectedVariant.available) {
        alert("Selected variant is not available for purchase");
        return;
      }

      const properties = this.getDeliveryProperties();
      // console.log('Delivery properties:', properties);

      const mainAdded = await this.addToCart(
        this.selectedVariant.id,
        1,
        properties
      );
      if (!mainAdded) {
        alert("Failed to add main product to cart");
        return;
      }

      // console.log('Adding accessories to cart:', this.selectedAccessories);
      for (const accessory of this.selectedAccessories) {
        const accessoryProperties = this.getAccessoryDeliveryProperties(
          accessory.id
        );
        await this.addToCart(
          accessory.id,
          accessory.quantity,
          accessoryProperties
        );
      }
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

    // Mark as hidden to prevent recursive calls
    this.sectionsHidden = true;

    // Add class to body for styling purposes
    document.body.classList.add("multistep-customize-mode");

    // Scroll to product section
    productSection.scrollIntoView({ behavior: "smooth", block: "start" });
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
