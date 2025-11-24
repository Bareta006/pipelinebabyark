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

    this.init();
  }

  init() {
    this.loadProductData();
    this.attachEventListeners();
    this.attachBannerListeners();
    this.showStep(1);
    this.currentSlide = 0;
  }

  loadProductData() {
    const productJsonScript = document.querySelector('[data-product-json]');
    if (productJsonScript) {
      try {
        this.productData = JSON.parse(productJsonScript.textContent);
      } catch (e) {
        console.error('Error parsing product JSON:', e);
      }
    }
  }

  attachEventListeners() {
    const customizeBtn = this.container.querySelector('[data-customize-btn]');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.showStep(2);
      });
    }

    const nextBtns = this.container.querySelectorAll('[data-next-step]');
    nextBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const nextStep = parseInt(e.currentTarget.dataset.nextStep);
        this.handleNextStep(nextStep, e.currentTarget);
      });
    });

    const prevBtns = this.container.querySelectorAll('[data-prev-step]');
    prevBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prevStep = parseInt(e.currentTarget.dataset.prevStep);
        this.showStep(prevStep);
      });
    });

    const addSmartBtn = this.container.querySelector('[data-add-smart-btn]');
    if (addSmartBtn) {
      addSmartBtn.addEventListener('click', () => this.selectSmartOption(true));
    }

    const skipSmartBtn = this.container.querySelector('[data-skip-smart-btn]');
    if (skipSmartBtn) {
      skipSmartBtn.addEventListener('click', () => this.selectSmartOption(false));
    }

    const checkoutBtn = this.container.querySelector('[data-checkout-btn]');
    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', () => this.goToCheckout());
    }

    const swatchRadios = this.container.querySelectorAll('[data-swatch-radio]');
    swatchRadios.forEach(radio => {
      radio.addEventListener('change', (e) => this.handleSwatchChange(e));
    });
  }

  async handleNextStep(nextStep, btn) {
    if (this.currentStep === 2) {
      if (!this.validateStep2()) {
        alert('Please select both color and shell color');
        return;
      }
    }

    if (this.currentStep === 4 && nextStep === 5) {
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Adding to cart...';

      await this.addAllToCart();

      btn.disabled = false;
      btn.textContent = originalText;
    }

    this.showStep(nextStep);
  }

  selectSmartOption(addSmart) {
    const smartOptionInput = this.container.querySelector('[data-smart-option-input]');
    if (!smartOptionInput) {
      console.error('Smart option input not found');
      return;
    }

    console.log('Smart option selected:', addSmart);
    console.log('Smart value:', smartOptionInput.dataset.smartValue);
    console.log('Non-smart value:', smartOptionInput.dataset.nonSmartValue);

    if (addSmart) {
      this.selectedSmartOption = smartOptionInput.dataset.smartValue;
    } else {
      this.selectedSmartOption = smartOptionInput.dataset.nonSmartValue;
    }

    console.log('Selected smart option:', this.selectedSmartOption);
    smartOptionInput.value = this.selectedSmartOption;

    this.selectFinalVariant();
    this.showStep(4);
  }

  handleSwatchChange() {
    const colorSelected = this.container.querySelector('input[name="color"]:checked');
    const shellColorSelected = this.container.querySelector('input[name="shell_color"]:checked');

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

    colorInputs.forEach(input => {
      const color = input.value;

      const availableVariant = this.productData.variants.find(v => {
        const matchesShell = v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
                            v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
                            v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

        const matchesColor = v.option1?.toLowerCase() === color?.toLowerCase() ||
                            v.option2?.toLowerCase() === color?.toLowerCase() ||
                            v.option3?.toLowerCase() === color?.toLowerCase();

        return matchesShell && matchesColor && v.available;
      });

      const swatchWrapper = input.closest('.swatch-option');
      if (swatchWrapper) {
        if (!availableVariant) {
          swatchWrapper.classList.add('swatch-option--disabled');
          input.disabled = true;
          if (input.checked) {
            input.checked = false;
            this.selectedColor = null;
          }
        } else {
          swatchWrapper.classList.remove('swatch-option--disabled');
          input.disabled = false;
        }
      }
    });
  }

  validateStep2() {
    this.selectedColor = this.container.querySelector('input[name="color"]:checked')?.value;
    this.selectedShellColor = this.container.querySelector('input[name="shell_color"]:checked')?.value;

    if (this.selectedColor && this.selectedShellColor) {
      this.selectPartialVariant();
      return true;
    }
    return false;
  }


  selectPartialVariant() {
    if (!this.productData) return;

    const variant = this.productData.variants.find(v => {
      const matchesColor = v.option1?.toLowerCase() === this.selectedColor?.toLowerCase() ||
                          v.option2?.toLowerCase() === this.selectedColor?.toLowerCase() ||
                          v.option3?.toLowerCase() === this.selectedColor?.toLowerCase();

      const matchesShell = v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
                          v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
                          v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

      return matchesColor && matchesShell;
    });

    if (variant) {
      this.updateImages(variant);
      this.updatePrice(variant);
    }
  }

  selectFinalVariant() {
    if (!this.productData) return;

    console.log('Selecting variant with:', {
      color: this.selectedColor,
      shell: this.selectedShellColor,
      smart: this.selectedSmartOption
    });

    const variant = this.productData.variants.find(v => {
      const matchesColor = v.option1?.toLowerCase() === this.selectedColor?.toLowerCase() ||
                          v.option2?.toLowerCase() === this.selectedColor?.toLowerCase() ||
                          v.option3?.toLowerCase() === this.selectedColor?.toLowerCase();

      const matchesShell = v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
                          v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
                          v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

      const matchesSmart = v.option1?.toLowerCase() === this.selectedSmartOption?.toLowerCase() ||
                          v.option2?.toLowerCase() === this.selectedSmartOption?.toLowerCase() ||
                          v.option3?.toLowerCase() === this.selectedSmartOption?.toLowerCase();

      return matchesColor && matchesShell && matchesSmart;
    });

    if (variant) {
      console.log('Found variant:', variant.id, variant.title);
      this.selectedVariant = variant;
      this.updateImages(variant);
      this.updatePrice(variant);
    } else {
      console.error('No variant found matching selections');
    }
  }

  updateImages(variant) {
    const event = new CustomEvent('theme:variant:change', {
      detail: { variant: variant },
      bubbles: true
    });

    this.container.dispatchEvent(event);

    if (this.currentStep === 2 && variant.featured_image) {
      const variantImg = this.container.querySelector('[data-variant-image]');
      if (variantImg) {
        variantImg.src = variant.featured_image.src.replace(/\.(jpg|jpeg|gif|png|bmp|bitmap|tiff|tif)(\?v=\d+)?$/i, '_800x.$1$2');
        this.goToSlide(0);
      }
    }
  }

  updatePrice(variant) {
    const priceElements = this.container.querySelectorAll('[data-product-price]');
    priceElements.forEach(el => {
      if (variant.price) {
        const formattedPrice = this.formatMoney(variant.price);
        el.textContent = formattedPrice;
      }
    });
  }

  formatMoney(cents) {
    const dollars = cents / 100;
    return '$' + dollars.toFixed(2);
  }

  getImageUrl(imageUrl, size = 400) {
    if (!imageUrl) return '';

    if (typeof imageUrl === 'string') {
      const url = imageUrl.replace(/\.(jpg|jpeg|gif|png|bmp|bitmap|tiff|tif)(\?v=\d+)?$/i, `_${size}x.$1$2`);
      return url;
    }

    return imageUrl;
  }

  async addToCart(variantId, quantity = 1, properties = {}) {
    const formData = {
      items: [{
        id: variantId,
        quantity: quantity,
        properties: properties
      }]
    };

    console.log('Adding to cart:', formData);

    try {
      const response = await fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Added to cart successfully:', result);
        const cart = await fetch('/cart.js').then(r => r.json());
        document.dispatchEvent(new CustomEvent('theme:cart:change', {
          detail: { cart: cart },
          bubbles: true
        }));
        return true;
      } else {
        const error = await response.json();
        console.error('Cart add failed:', error);
        return false;
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      return false;
    }
  }


  attachAccessoryListeners() {
    const container = this.container.querySelector('[data-accessories-container]');
    if (!container) return;

    const accessoryItems = container.querySelectorAll('[data-accessory-item]');
    accessoryItems.forEach(item => {
      const variantOptions = item.querySelectorAll('[data-variant-option]');
      const checkbox = item.querySelector('[data-accessory-checkbox]');

      variantOptions.forEach(option => {
        option.addEventListener('change', (e) => {
          this.updateAccessoryVariant(item);
          this.updateAccessoryImage(item, e.target);
        });
      });

      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          const variantId = parseInt(e.target.dataset.accessoryId);
          const accessoryTitle = e.target.dataset.accessoryTitle;
          const accessoryPrice = parseInt(e.target.dataset.accessoryPrice);
          const accessoryImage = item.querySelector('[data-accessory-image]')?.src || '';

          if (e.target.checked) {
            this.addAccessory(variantId, accessoryTitle, accessoryPrice, accessoryImage);
          } else {
            this.removeAccessory(variantId);
          }
        });
      }
    });
  }

  updateAccessoryVariant(item) {
    const checkbox = item.querySelector('[data-accessory-checkbox]');
    if (!checkbox) return;

    const selectedOptions = [];
    const variantOptions = item.querySelectorAll('[data-variant-option]:checked');
    variantOptions.forEach(option => {
      const position = parseInt(option.dataset.optionPosition);
      selectedOptions[position - 1] = option.value;
    });

    const priceEl = item.querySelector('.accessory-item__price');
    if (priceEl) {
      const wasChecked = checkbox.checked;
      const oldVariantId = parseInt(checkbox.dataset.accessoryId);

      if (wasChecked) {
        this.removeAccessory(oldVariantId);
      }
    }
  }

  updateAccessoryImage(item, changedOption) {
    const imageEl = item.querySelector('[data-accessory-image]');
    if (!imageEl) return;

    const newImageUrl = changedOption.dataset.variantImage;
    if (newImageUrl) {
      imageEl.src = newImageUrl;
    }
  }

  addAccessory(variantId, title, price, image) {
    const existing = this.selectedAccessories.find(acc => acc.id === variantId);
    if (!existing) {
      this.selectedAccessories.push({
        id: variantId,
        title: title,
        price: price,
        image: image
      });
    }
  }

  removeAccessory(variantId) {
    const index = this.selectedAccessories.findIndex(acc => acc.id === variantId);
    if (index > -1) {
      this.selectedAccessories.splice(index, 1);
    }
  }

  showStep(stepNumber) {
    this.currentStep = stepNumber;

    const steps = this.container.querySelectorAll('[data-step]');
    steps.forEach(step => {
      const stepNum = parseInt(step.dataset.step);
      step.style.display = stepNum === stepNumber ? 'block' : 'none';
    });

    if (stepNumber >= 2) {
      document.body.classList.add('multistep-fullscreen');
    } else {
      document.body.classList.remove('multistep-fullscreen');
    }

    window.scrollTo(0, 0);

    const mainContent = document.querySelector('#MainContent');
    if (mainContent) {
      mainContent.scrollTo(0, 0);
    }

    this.updateProgress();

    if (stepNumber === 2) {
      this.initializeSlider();
    }

    if (stepNumber === 4) {
      this.attachAccessoryListeners();
    }

    if (stepNumber === 5) {
      this.renderOrderSummary();
    }
  }

  initializeSlider() {
    const sliderTrack = this.container.querySelector('[data-slider-track]');
    const prevBtn = this.container.querySelector('[data-slider-prev]');
    const nextBtn = this.container.querySelector('[data-slider-next]');

    if (!sliderTrack) return;

    const slides = sliderTrack.querySelectorAll('.slider-slide');

    if (slides.length === 0) return;

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentSlide > 0) {
          this.goToSlide(this.currentSlide - 1);
        }
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentSlide < slides.length - 1) {
          this.goToSlide(this.currentSlide + 1);
        }
      });
    }

    this.updateSliderArrows();

    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    sliderTrack.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      isDragging = true;
    });

    sliderTrack.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
    });

    sliderTrack.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;

      const diff = startX - currentX;

      if (Math.abs(diff) > 50) {
        if (diff > 0 && this.currentSlide < slides.length - 1) {
          this.goToSlide(this.currentSlide + 1);
        } else if (diff < 0 && this.currentSlide > 0) {
          this.goToSlide(this.currentSlide - 1);
        }
      }
    });

    sliderTrack.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      isDragging = true;
      e.preventDefault();
    });

    sliderTrack.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      currentX = e.clientX;
    });

    sliderTrack.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;

      const diff = startX - currentX;
      const slides = sliderTrack.querySelectorAll('.slider-slide');

      if (Math.abs(diff) > 50) {
        if (diff > 0 && this.currentSlide < slides.length - 1) {
          this.goToSlide(this.currentSlide + 1);
        } else if (diff < 0 && this.currentSlide > 0) {
          this.goToSlide(this.currentSlide - 1);
        }
      }
    });

    sliderTrack.addEventListener('mouseleave', () => {
      isDragging = false;
    });
  }

  goToSlide(index) {
    const sliderTrack = this.container.querySelector('[data-slider-track]');

    if (!sliderTrack) return;

    this.currentSlide = index;

    sliderTrack.style.transform = `translateX(-${index * 100}%)`;

    this.updateSliderArrows();
  }

  updateSliderArrows() {
    const prevBtn = this.container.querySelector('[data-slider-prev]');
    const nextBtn = this.container.querySelector('[data-slider-next]');
    const sliderTrack = this.container.querySelector('[data-slider-track]');

    if (!sliderTrack) return;

    const slides = sliderTrack.querySelectorAll('.slider-slide');

    if (prevBtn) {
      if (this.currentSlide === 0) {
        prevBtn.style.opacity = '0.3';
        prevBtn.style.pointerEvents = 'none';
      } else {
        prevBtn.style.opacity = '1';
        prevBtn.style.pointerEvents = 'auto';
      }
    }

    if (nextBtn) {
      if (this.currentSlide === slides.length - 1) {
        nextBtn.style.opacity = '0.3';
        nextBtn.style.pointerEvents = 'none';
      } else {
        nextBtn.style.opacity = '1';
        nextBtn.style.pointerEvents = 'auto';
      }
    }
  }

  updateProgress() {
    const progressContainer = this.container.querySelector('[data-progress-dots]');

    if (this.currentStep === 1) {
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
    } else {
      if (progressContainer) {
        progressContainer.style.display = 'block';
      }

      const dots = this.container.querySelectorAll('[data-step-dot]');
      dots.forEach((dot) => {
        const dotStep = parseInt(dot.dataset.stepNumber);

        dot.classList.remove('active', 'completed');

        if (dotStep < this.currentStep) {
          dot.classList.add('completed');
        } else if (dotStep === this.currentStep) {
          dot.classList.add('active');
        }
      });
    }
  }

  renderOrderSummary() {
    const summaryContainer = this.container.querySelector('[data-order-summary]');
    const totalsContainer = this.container.querySelector('[data-summary-totals]');
    if (!summaryContainer) return;

    let html = '<div class="order-summary">';

    if (this.selectedVariant) {
      const variantImage = this.selectedVariant.featured_image?.src || this.productData.featured_image;
      const imageUrl = variantImage ? this.getImageUrl(variantImage, 200) : '';
      const discountedPrice = this.selectedVariant.price * 0.8;

      html += `
        <div class="summary-item summary-item--product">
        <div class="summary-product-details-container">
          <div class="summary-product-image">
            ${imageUrl ? `<img src="${imageUrl}" alt="${this.productData.title}">` : ''}
          </div>
          <div class="summary-product-details">
            <h4 class="summary-product-title">${this.productData.title}</h4>
            <p class="summary-variant-info">Color: ${this.selectedColor}, Shell: ${this.selectedShellColor}, ${this.selectedSmartOption}</p>
          </div>
          </div>
          <div class="summary-product-pricing">
            <p class="summary-price-discounted">${this.formatMoney(discountedPrice)}</p>
            <p class="summary-price-full">${this.formatMoney(this.selectedVariant.price)}</p>
          </div>
        </div>
      `;
    }

    if (this.selectedAccessories.length > 0) {
      this.selectedAccessories.forEach(accessory => {
        const discountedPrice = accessory.price * 0.8;
        const imageUrl = accessory.image ? this.getImageUrl(accessory.image, 200) : '';

        html += `
          <div class="summary-item summary-item--product">
            <div class="summary-product-details-container">
              <div class="summary-product-image">
                ${imageUrl ? `<img src="${imageUrl}" alt="${accessory.title}">` : ''}
              </div>
              <div class="summary-product-details">
                <h4 class="summary-product-title">${accessory.title}</h4>
              </div>
            </div>
            <div class="summary-product-pricing">
              <p class="summary-price-discounted">${this.formatMoney(discountedPrice)}</p>
              <p class="summary-price-full">${this.formatMoney(accessory.price)}</p>
            </div>
          </div>
        `;
      });
    }

    console.log('Selected smart option:', this.selectedSmartOption);

    if (this.selectedSmartOption && this.selectedSmartOption.toLowerCase().includes('non')) {
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
            <span>14 sensors, alerts & more $200</span>
            </div>
          </div>
          <button data-upgrade-to-smart class="btn-text-add-upgrade">ADD</button>
        </div>
      `;
    }

    html += '</div>';

    summaryContainer.innerHTML = html;

    let subtotal = 0;
    let totalDiscounted = 0;

    if (this.selectedVariant) {
      subtotal += this.selectedVariant.price;
      totalDiscounted += this.selectedVariant.price * 0.8;
    }

    this.selectedAccessories.forEach(accessory => {
      subtotal += accessory.price;
      totalDiscounted += accessory.price * 0.8;
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
            <span>${this.formatMoney(totalDiscounted)}</span>
          </div>
        </div>
      `;
    }

    const upgradeBtn = summaryContainer.querySelector('[data-upgrade-to-smart]');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => this.upgradeToSmart());
    }
  }

  upgradeToSmart() {
    const smartOptionInput = this.container.querySelector('[data-smart-option-input]');
    if (!smartOptionInput) {
      console.error('Smart option input not found');
      return;
    }

    this.selectedSmartOption = smartOptionInput.dataset.smartValue;

    const smartVariant = this.productData.variants.find(v => {
      const matchesColor = v.option1?.toLowerCase() === this.selectedColor?.toLowerCase() ||
                          v.option2?.toLowerCase() === this.selectedColor?.toLowerCase() ||
                          v.option3?.toLowerCase() === this.selectedColor?.toLowerCase();

      const matchesShell = v.option1?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
                          v.option2?.toLowerCase() === this.selectedShellColor?.toLowerCase() ||
                          v.option3?.toLowerCase() === this.selectedShellColor?.toLowerCase();

      const matchesSmart = v.option1?.toLowerCase() === this.selectedSmartOption?.toLowerCase() ||
                          v.option2?.toLowerCase() === this.selectedSmartOption?.toLowerCase() ||
                          v.option3?.toLowerCase() === this.selectedSmartOption?.toLowerCase();

      return matchesColor && matchesShell && matchesSmart;
    });

    if (smartVariant) {
      this.selectedVariant = smartVariant;
      this.renderOrderSummary();
    } else {
      console.error('Smart variant not found');
      alert('Smart version not available for this combination');
    }
  }

  async addAllToCart() {
    try {
      if (!this.selectedVariant) {
        console.error('No variant selected');
        alert('Please complete all steps before checkout');
        return;
      }

      console.log('Adding main product to cart:', this.selectedVariant);
      console.log('Variant available:', this.selectedVariant.available);

      if (!this.selectedVariant.available) {
        alert('Selected variant is not available for purchase');
        return;
      }

      const mainAdded = await this.addToCart(this.selectedVariant.id, 1);
      if (!mainAdded) {
        alert('Failed to add main product to cart');
        return;
      }

      console.log('Adding accessories to cart:', this.selectedAccessories);
      for (const accessory of this.selectedAccessories) {
        await this.addToCart(accessory.id, 1);
      }
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('There was an error adding items to cart. Please try again.');
    }
  }

  async goToCheckout() {
    window.location.href = '/checkout';
  }

  attachBannerListeners() {
    const featureItems = this.container.querySelectorAll('[data-feature-modal]');
    const backdrop = document.querySelector('[data-feature-backdrop]');
    const closeBtn = document.querySelector('[data-feature-close]');
    const customizeBtn = document.querySelector('[data-feature-customize]');
    const modalBody = document.querySelector('[data-feature-modal-body]');

    if (!backdrop || !modalBody) return;

    featureItems.forEach(item => {
      item.addEventListener('click', () => {
        const featureId = item.dataset.featureModal;
        const featureDataScript = document.querySelector(`[data-feature-data="${featureId}"]`);

        if (featureDataScript) {
          try {
            const featureData = JSON.parse(featureDataScript.textContent);

            modalBody.innerHTML = `
            <div class="feature-modal-fixed-height">
             <div class="feature-modal-body-dynamic-content">
              ${featureData.image ? `<img src="${featureData.image}" alt="${featureData.title}" class="feature-modal-body-dynamic-content-image">` : ''}
              <div class="feature-modal-body-dynamic-content-text">
              <h3>${featureData.title}</h3>
              <p>${featureData.description}</p>
              <div>
              </div>
              </div>
            `;

            backdrop.style.display = 'flex';
          } catch (error) {
            console.error('Error loading feature data:', error);
          }
        }
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
      });
    }

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.style.display = 'none';
      }
    });

    if (customizeBtn) {
      customizeBtn.addEventListener('click', () => {
        backdrop.style.display = 'none';
        const customizeBtnMain = this.container.querySelector('[data-customize-btn]');
        if (customizeBtnMain) {
          customizeBtnMain.click();
        }
      });
    }
  }
}

document.addEventListener('DOMContentLoaded', function() {
  const multiStepContainer = document.querySelector('[data-multistep-container]');
  if (multiStepContainer) {
    new ProductMultiStep(multiStepContainer);
  }
});
