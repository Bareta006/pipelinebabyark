/**
 * Variant Image Filter
 * 
 * This script adds functionality to filter product images based on variant color selection.
 * When a color variant is selected, it shows only images with matching alt text and rebuilds
 * the carousel in mobile view to avoid blank slides.
 */

(function() {
  // Initialize when DOM is fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    initVariantImageFilter();
  });

  // Also initialize when the page content is updated (for quick view or ajax loaded content)
  document.addEventListener('theme:section:load', function() {
    initVariantImageFilter();
  });

  function initVariantImageFilter() {
    // Find the product form and variant selectors
    const productForms = document.querySelectorAll('[data-product-form]');
    
    productForms.forEach(form => {
      // Find variant selectors (radio buttons, select dropdowns, etc.)
      const variantSelectors = form.querySelectorAll('[name^="options"]');
      const variantIdInput = form.querySelector('[name="id"]');
      
      if (!variantSelectors.length || !variantIdInput) return;
      
      // Add change event listeners to variant selectors
      variantSelectors.forEach(selector => {
        selector.addEventListener('change', function() {
          // Get the selected variant ID
          const variantId = variantIdInput.value;
          if (!variantId) return;
          
          // Find the product JSON data
          const productJsonScript = document.querySelector('[data-product-json]');
          if (!productJsonScript) return;
          
          try {
            const productData = JSON.parse(productJsonScript.textContent);
            const selectedVariant = productData.variants.find(v => v.id.toString() === variantId.toString());
            
            if (selectedVariant) {
              filterImagesByVariantColor(selectedVariant, productData);
            }
          } catch (e) {
            console.error('Error parsing product JSON:', e);
          }
        });
      });
      
      // Also listen for variant ID changes directly (for programmatic changes)
      variantIdInput.addEventListener('change', function() {
        const variantId = this.value;
        if (!variantId) return;
        
        const productJsonScript = document.querySelector('[data-product-json]');
        if (!productJsonScript) return;
        
        try {
          const productData = JSON.parse(productJsonScript.textContent);
          const selectedVariant = productData.variants.find(v => v.id.toString() === variantId.toString());
          
          if (selectedVariant) {
            filterImagesByVariantColor(selectedVariant, productData);
          }
        } catch (e) {
          console.error('Error parsing product JSON:', e);
        }
      });
    });
  }

  function filterImagesByVariantColor(variant, productData) {
    if (!variant || !productData) return;

    // Find the color option index
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex === -1) return; // No color option found
    
    const selectedColor = variant.options[colorOptionIndex];
    if (!selectedColor) return;

    // Get all media slides and thumbs
    const mediaSlides = document.querySelectorAll('[data-media-slide]');
    const thumbs = document.querySelectorAll('[data-slideshow-thumbnail]');
    
    if (!mediaSlides.length) return;

    let hasVisibleSlides = false;
    let firstVisibleSlide = null;
    let visibleSlideCount = 0;

    // Filter media slides based on alt text
    mediaSlides.forEach(slide => {
      const altText = slide.getAttribute('aria-label') || '';
      const imageFilter = slide.getAttribute('data-image-filter') || '';
      
      // Check for exact match or substring match
      // First try exact match with the color name
      const exactMatch = altText === selectedColor || imageFilter === selectedColor;
      
      // Then try to see if the color name is contained in the alt text
      const containsMatch = altText.includes(selectedColor) || imageFilter.includes(selectedColor);
      
      const shouldShow = exactMatch || containsMatch;
      
      if (shouldShow) {
        slide.classList.remove('hide');
        hasVisibleSlides = true;
        visibleSlideCount++;
        if (!firstVisibleSlide) {
          firstVisibleSlide = slide;
        }
      } else {
        slide.classList.add('hide');
      }
    });

    // If no slides match the color, show all slides (fallback)
    if (visibleSlideCount === 0) {
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
      thumbs.forEach(thumb => {
        const altText = thumb.getAttribute('aria-label') || '';
        const imageFilter = thumb.getAttribute('data-image-filter') || '';
        
        // Check for exact match or substring match
        const exactMatch = altText === selectedColor || imageFilter === selectedColor;
        const containsMatch = altText.includes(selectedColor) || imageFilter.includes(selectedColor);
        
        const shouldShow = exactMatch || containsMatch;
        
        if (shouldShow) {
          thumb.style.display = '';
        } else {
          thumb.style.display = 'none';
        }
      });
    }

    // If we're in mobile carousel mode, rebuild the carousel
    const isMobile = window.innerWidth < 768;
    const slideshow = document.querySelector('[data-product-slideshow]');
    
    if (isMobile && slideshow && hasVisibleSlides) {
      // Find the Flickity instance
      if (typeof Flickity !== 'undefined') {
        const flkty = Flickity.data(slideshow);
        
        if (flkty) {
          // Destroy and recreate the carousel to avoid blank slides
          flkty.destroy();
          
          // Create mobile slider with appropriate options
          const mobileStyle = slideshow.getAttribute('data-slideshow-mobile-style') || 'carousel';
          
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
          new Flickity(slideshow, mobileOptions);
          
          // If we have a first visible slide, select it
          if (firstVisibleSlide) {
            const mediaId = firstVisibleSlide.getAttribute('data-media-id');
            if (mediaId) {
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