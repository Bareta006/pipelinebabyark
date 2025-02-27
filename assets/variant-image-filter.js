/**
 * Variant Image Filter
 * 
 * This script adds functionality to filter product images based on variant color selection.
 * When a color variant is selected, it shows only images with matching alt text and rebuilds
 * the carousel in mobile view to avoid blank slides.
 */

(function() {
  console.log('🔍 Variant Image Filter script loaded');
  
  // Initialize when DOM is fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 DOM loaded, initializing variant image filter');
    initVariantImageFilter();
  });

  // Also initialize when the page content is updated (for quick view or ajax loaded content)
  document.addEventListener('theme:section:load', function() {
    console.log('🔍 Section loaded, initializing variant image filter');
    initVariantImageFilter();
  });

  // Listen for the theme's variant change event
  document.addEventListener('theme:variant:change', function(event) {
    console.log('🔍 Variant change event detected:', event.detail);
    if (event.detail && event.detail.variant) {
      const productJsonScript = document.querySelector('[data-product-json]');
      if (productJsonScript) {
        try {
          const productData = JSON.parse(productJsonScript.textContent);
          console.log('🔍 Product data from variant change event:', productData.title);
          filterImagesByVariantColor(event.detail.variant, productData);
        } catch (e) {
          console.error('🔍 Error parsing product JSON from variant change event:', e);
        }
      }
    }
  });

  function initVariantImageFilter() {
    // Try different selectors for the product form
    const productForms = document.querySelectorAll('[data-product-form]');
    console.log('🔍 Found product forms with [data-product-form]:', productForms.length);
    
    if (productForms.length === 0) {
      // Try alternative selectors
      const formHolders = document.querySelectorAll('[data-form-holder]');
      console.log('🔍 Found form holders with [data-form-holder]:', formHolders.length);
      
      if (formHolders.length > 0) {
        formHolders.forEach((holder, index) => {
          console.log(`🔍 Processing form holder #${index + 1}`);
          const forms = holder.querySelectorAll('form');
          console.log(`🔍 Form holder #${index + 1} - Forms found:`, forms.length);
          
          forms.forEach((form, formIndex) => {
            setupFormListeners(form, formIndex);
          });
        });
      }
    }
    
    productForms.forEach((form, index) => {
      setupFormListeners(form, index);
    });
  }
  
  function setupFormListeners(form, index) {
    console.log(`🔍 Setting up listeners for form #${index + 1}`, form);
    
    // Find variant selectors (radio buttons, select dropdowns, etc.)
    const variantSelectors = form.querySelectorAll('[name^="options"]');
    const variantIdInput = form.querySelector('[name="id"]');
    
    console.log(`🔍 Form #${index + 1} - Variant selectors:`, variantSelectors.length);
    console.log(`🔍 Form #${index + 1} - Variant ID input:`, variantIdInput ? 'Found' : 'Not found');
    
    if (!variantSelectors.length || !variantIdInput) {
      console.log(`🔍 Form #${index + 1} - Missing variant selectors or ID input, skipping`);
      return;
    }
    
    // Add change event listeners to variant selectors
    variantSelectors.forEach((selector, selectorIndex) => {
      console.log(`🔍 Form #${index + 1} - Adding change listener to selector #${selectorIndex + 1}`, selector);
      
      selector.addEventListener('change', function() {
        console.log(`🔍 Variant selector changed - Form #${index + 1}, Selector #${selectorIndex + 1}`);
        
        // Get the selected variant ID
        const variantId = variantIdInput.value;
        console.log(`🔍 Selected variant ID:`, variantId);
        
        if (!variantId) {
          console.log('🔍 No variant ID found, skipping');
          return;
        }
        
        // Find the product JSON data
        const productJsonScript = document.querySelector('[data-product-json]');
        console.log(`🔍 Product JSON script:`, productJsonScript ? 'Found' : 'Not found');
        
        if (!productJsonScript) {
          console.log('🔍 No product JSON found, trying to find alternative data source');
          return;
        }
        
        try {
          const productData = JSON.parse(productJsonScript.textContent);
          console.log('🔍 Product data parsed:', productData.title);
          console.log('🔍 Available variants:', productData.variants.length);
          
          const selectedVariant = productData.variants.find(v => v.id.toString() === variantId.toString());
          console.log('🔍 Selected variant:', selectedVariant ? selectedVariant.title : 'Not found');
          
          if (selectedVariant) {
            filterImagesByVariantColor(selectedVariant, productData);
          } else {
            console.log('🔍 Selected variant not found in product data');
          }
        } catch (e) {
          console.error('🔍 Error parsing product JSON:', e);
        }
      });
    });
    
    // Also listen for variant ID changes directly (for programmatic changes)
    console.log(`🔍 Form #${index + 1} - Adding change listener to variant ID input`);
    variantIdInput.addEventListener('change', function() {
      console.log('🔍 Variant ID input changed directly');
      
      const variantId = this.value;
      console.log(`🔍 New variant ID:`, variantId);
      
      if (!variantId) {
        console.log('🔍 No variant ID found, skipping');
        return;
      }
      
      const productJsonScript = document.querySelector('[data-product-json]');
      console.log(`🔍 Product JSON script:`, productJsonScript ? 'Found' : 'Not found');
      
      if (!productJsonScript) {
        console.log('🔍 No product JSON found, trying to find alternative data source');
        return;
      }
      
      try {
        const productData = JSON.parse(productJsonScript.textContent);
        console.log('🔍 Product data parsed:', productData.title);
        
        const selectedVariant = productData.variants.find(v => v.id.toString() === variantId.toString());
        console.log('🔍 Selected variant:', selectedVariant ? selectedVariant.title : 'Not found');
        
        if (selectedVariant) {
          filterImagesByVariantColor(selectedVariant, productData);
        } else {
          console.log('🔍 Selected variant not found in product data');
        }
      } catch (e) {
        console.error('🔍 Error parsing product JSON:', e);
      }
    });
  }

  function filterImagesByVariantColor(variant, productData) {
    console.log('🔍 Filtering images by variant color');
    console.log('🔍 Variant:', variant);
    
    if (!variant || !productData) {
      console.log('🔍 Missing variant or product data, aborting');
      return;
    }

    // Find the color option index
    console.log('🔍 Product options:', productData.options);
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    console.log('🔍 Color option index:', colorOptionIndex);
    
    if (colorOptionIndex === -1) {
      console.log('🔍 No color option found, aborting');
      return;
    }
    
    const selectedColor = variant.options[colorOptionIndex];
    console.log('🔍 Selected color:', selectedColor);
    
    if (!selectedColor) {
      console.log('🔍 No color value found, aborting');
      return;
    }

    // Get all media slides and thumbs
    const mediaSlides = document.querySelectorAll('[data-media-slide]');
    const thumbs = document.querySelectorAll('[data-slideshow-thumbnail]');
    
    console.log('🔍 Media slides found:', mediaSlides.length);
    console.log('🔍 Thumbnails found:', thumbs.length);
    
    if (!mediaSlides.length) {
      console.log('🔍 No media slides found, aborting');
      return;
    }

    let hasVisibleSlides = false;
    let firstVisibleSlide = null;
    let visibleSlideCount = 0;

    // Filter media slides based on alt text
    console.log('🔍 Filtering media slides...');
    mediaSlides.forEach((slide, index) => {
      const altText = slide.getAttribute('aria-label') || '';
      const imageFilter = slide.getAttribute('data-image-filter') || '';
      
      console.log(`🔍 Slide #${index + 1} - Alt text:`, altText);
      console.log(`🔍 Slide #${index + 1} - Image filter:`, imageFilter);
      
      // Check for exact match or substring match
      // First try exact match with the color name
      const exactMatch = altText === selectedColor || imageFilter === selectedColor;
      
      // Then try to see if the color name is contained in the alt text
      const containsMatch = altText.includes(selectedColor) || imageFilter.includes(selectedColor);
      
      // For complex color names like "Eggshell White / Moonlight", split and check each part
      let complexMatch = false;
      if (!exactMatch && !containsMatch && (selectedColor.includes('/') || selectedColor.includes(' '))) {
        const colorParts = selectedColor.split(/[\s\/]+/).filter(part => part.trim().length > 0);
        console.log(`🔍 Slide #${index + 1} - Complex color parts:`, colorParts);
        
        // Check if any part of the color name matches
        complexMatch = colorParts.some(part => {
          const partMatch = altText.includes(part) || imageFilter.includes(part);
          if (partMatch) {
            console.log(`🔍 Slide #${index + 1} - Matched on color part:`, part);
          }
          return partMatch;
        });
      }
      
      const shouldShow = exactMatch || containsMatch || complexMatch;
      console.log(`🔍 Slide #${index + 1} - Should show:`, shouldShow, '(Exact match:', exactMatch, ', Contains match:', containsMatch, ', Complex match:', complexMatch, ')');
      
      if (shouldShow) {
        slide.classList.remove('hide');
        hasVisibleSlides = true;
        visibleSlideCount++;
        if (!firstVisibleSlide) {
          firstVisibleSlide = slide;
          console.log(`🔍 First visible slide set to #${index + 1}`);
        }
      } else {
        slide.classList.add('hide');
        console.log(`🔍 Hiding slide #${index + 1}`);
      }
    });

    console.log('🔍 Visible slide count:', visibleSlideCount);
    
    // If no slides match the color, show all slides (fallback)
    if (visibleSlideCount === 0) {
      console.log('🔍 No matching slides found, showing all slides as fallback');
      mediaSlides.forEach(slide => {
        slide.classList.remove('hide');
      });
      
      if (thumbs.length) {
        thumbs.forEach(thumb => {
          thumb.style.display = '';
        });
      }
      return;
    }

    // Filter thumbnails to match
    if (thumbs.length) {
      console.log('🔍 Filtering thumbnails...');
      thumbs.forEach((thumb, index) => {
        const altText = thumb.getAttribute('aria-label') || '';
        const imageFilter = thumb.getAttribute('data-image-filter') || '';
        
        console.log(`🔍 Thumb #${index + 1} - Alt text:`, altText);
        console.log(`🔍 Thumb #${index + 1} - Image filter:`, imageFilter);
        
        // Check for exact match or substring match
        const exactMatch = altText === selectedColor || imageFilter === selectedColor;
        const containsMatch = altText.includes(selectedColor) || imageFilter.includes(selectedColor);
        
        // For complex color names like "Eggshell White / Moonlight", split and check each part
        let complexMatch = false;
        if (!exactMatch && !containsMatch && (selectedColor.includes('/') || selectedColor.includes(' '))) {
          const colorParts = selectedColor.split(/[\s\/]+/).filter(part => part.trim().length > 0);
          console.log(`🔍 Thumb #${index + 1} - Complex color parts:`, colorParts);
          
          // Check if any part of the color name matches
          complexMatch = colorParts.some(part => {
            const partMatch = altText.includes(part) || imageFilter.includes(part);
            if (partMatch) {
              console.log(`🔍 Thumb #${index + 1} - Matched on color part:`, part);
            }
            return partMatch;
          });
        }
        
        const shouldShow = exactMatch || containsMatch || complexMatch;
        console.log(`🔍 Thumb #${index + 1} - Should show:`, shouldShow, '(Exact match:', exactMatch, ', Contains match:', containsMatch, ', Complex match:', complexMatch, ')');
        
        if (shouldShow) {
          thumb.style.display = '';
          console.log(`🔍 Showing thumb #${index + 1}`);
        } else {
          thumb.style.display = 'none';
          console.log(`🔍 Hiding thumb #${index + 1}`);
        }
      });
    }

    // If we're in mobile carousel mode, rebuild the carousel
    const isMobile = window.innerWidth < 768;
    const slideshow = document.querySelector('[data-product-slideshow]');
    
    console.log('🔍 Is mobile:', isMobile);
    console.log('🔍 Slideshow element:', slideshow ? 'Found' : 'Not found');
    console.log('🔍 Has visible slides:', hasVisibleSlides);
    
    if (isMobile && slideshow && hasVisibleSlides) {
      console.log('🔍 Attempting to rebuild mobile carousel');
      
      // Find the Flickity instance
      console.log('🔍 Flickity available:', typeof Flickity !== 'undefined');
      
      if (typeof Flickity !== 'undefined') {
        const flkty = Flickity.data(slideshow);
        console.log('🔍 Flickity instance:', flkty ? 'Found' : 'Not found');
        
        if (flkty) {
          // Destroy and recreate the carousel to avoid blank slides
          console.log('🔍 Destroying existing Flickity instance');
          flkty.destroy();
          
          // Create mobile slider with appropriate options
          const mobileStyle = slideshow.getAttribute('data-slideshow-mobile-style') || 'carousel';
          console.log('🔍 Mobile style:', mobileStyle);
          
          const mobileOptions = {
            autoPlay: false,
            prevNextButtons: false,
            pageDots: mobileStyle === 'slideshow',
            adaptiveHeight: true,
            accessibility: true,
            watchCSS: false,
            wrapAround: true,
            rightToLeft: window.isRTL,
            dragThreshold: mobileStyle === 'carousel' ? 10 : 80,
            contain: mobileStyle !== 'carousel',
            fade: mobileStyle !== 'carousel' && mobileStyle !== 'slideshow'
          };
          
          // Recreate the slider
          console.log('🔍 Creating new Flickity instance with options:', mobileOptions);
          new Flickity(slideshow, mobileOptions);
          
          // If we have a first visible slide, select it
          if (firstVisibleSlide) {
            const mediaId = firstVisibleSlide.getAttribute('data-media-id');
            console.log('🔍 First visible slide media ID:', mediaId);
            
            if (mediaId) {
              console.log('🔍 Dispatching theme:image:change event with media ID:', mediaId);
              slideshow.dispatchEvent(new CustomEvent('theme:image:change', {
                detail: {
                  id: mediaId
                }
              }));
            }
          }
        }
      }
    }
  }
})(); 