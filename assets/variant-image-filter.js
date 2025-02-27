/**
 * Variant Image Filter
 * 
 * This script adds functionality to filter product images based on variant color selection.
 * When a color variant is selected, it shows only images with matching alt text and rebuilds
 * the carousel in mobile view to avoid blank slides.
 */

(function() {
  console.log('🔍 Variant Image Filter script loaded');
  
  // Listen for the theme's variant change event
  document.addEventListener('theme:variant:change', function(event) {
    console.log('🔍 Variant change event detected');
    if (event.detail && event.detail.variant) {
      const productJsonScript = document.querySelector('[data-product-json]');
      if (productJsonScript) {
        try {
          const productData = JSON.parse(productJsonScript.textContent);
          filterImagesByVariantColor(event.detail.variant, productData);
        } catch (e) {
          console.error('Error parsing product JSON:', e);
        }
      }
    }
  });

  function filterImagesByVariantColor(variant, productData) {
    console.log('🔍 Filtering images by variant color');
    
    if (!variant || !productData) return;

    // Find the color option index
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex === -1) return; // No color option found
    
    const selectedColor = variant.options[colorOptionIndex];
    console.log('🔍 Selected color:', selectedColor);
    
    if (!selectedColor) return;

    // Get all media slides and thumbs
    const mediaSlides = document.querySelectorAll('[data-media-slide]');
    const thumbs = document.querySelectorAll('[data-slideshow-thumbnail]');
    
    console.log('🔍 Media slides found:', mediaSlides.length);
    
    if (!mediaSlides.length) return;

    let hasVisibleSlides = false;
    let firstVisibleSlide = null;
    let visibleSlideCount = 0;

    // Filter media slides based on EXACT alt text match only
    console.log('🔍 Filtering slides - looking for EXACT match with:', selectedColor);
    
    // Check if the 'hide' class is properly defined in CSS
    const testStyle = document.createElement('style');
    testStyle.textContent = '.hide-test { display: none !important; }';
    document.head.appendChild(testStyle);
    
    const testElement = document.createElement('div');
    testElement.classList.add('hide-test');
    document.body.appendChild(testElement);
    
    const computedStyle = window.getComputedStyle(testElement);
    console.log('🔍 Test element with hide-test class has display:', computedStyle.display);
    
    // Check what the 'hide' class does in the theme
    const existingHideRule = Array.from(document.styleSheets)
      .flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules);
        } catch (e) {
          return [];
        }
      })
      .find(rule => rule.selectorText === '.hide');
    
    console.log('🔍 Existing .hide CSS rule:', existingHideRule ? existingHideRule.cssText : 'Not found');
    
    // Clean up test elements
    testElement.remove();
    testStyle.remove();
    
    mediaSlides.forEach((slide, index) => {
      const altText = slide.getAttribute('aria-label') || '';
      const exactMatch = altText === selectedColor;
      
      console.log(`🔍 Slide #${index + 1} - Alt text: "${altText}" - Exact match: ${exactMatch}`);
      
      if (exactMatch) {
        // Show matching slides
        slide.style.display = '';
        slide.classList.remove('hide'); // Also remove hide class just in case
        hasVisibleSlides = true;
        visibleSlideCount++;
        if (!firstVisibleSlide) {
          firstVisibleSlide = slide;
          console.log(`🔍 First visible slide set to #${index + 1}`);
        }
      } else {
        // Hide non-matching slides
        slide.style.display = 'none';
        slide.classList.add('hide'); // Also add hide class for compatibility
        console.log(`🔍 Hiding slide #${index + 1}`);
        // Verify the slide is hidden
        console.log(`🔍 Slide #${index + 1} display style:`, slide.style.display);
      }
    });

    console.log('🔍 Visible slide count after filtering:', visibleSlideCount);
    
    // Log the display style of all slides after filtering
    console.log('🔍 Final slide visibility status:');
    mediaSlides.forEach((slide, index) => {
      const altText = slide.getAttribute('aria-label') || '';
      console.log(`🔍 Slide #${index + 1} - Alt text: "${altText}" - Display: ${slide.style.display || 'default'}`);
    });
    
    // If no slides match the color, show all slides (fallback)
    if (visibleSlideCount === 0) {
      console.log('🔍 No matching slides found, showing all slides as fallback');
      mediaSlides.forEach(slide => {
        slide.style.display = '';
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
        const exactMatch = altText === selectedColor;
        
        if (exactMatch) {
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