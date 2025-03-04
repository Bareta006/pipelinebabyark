/**
 * Variant Image Filter
 * 
 * This script adds functionality to filter product images based on variant color selection.
 * When a color variant is selected, it shows only images with matching alt text and rebuilds
 * the carousel in mobile view to avoid blank slides.
 */

(function() {
  // Initialize on page load to filter images for the initially selected variant
  document.addEventListener('DOMContentLoaded', function() {
    initializeWithSelectedVariant();
  });
  
  // Fallback in case DOMContentLoaded has already fired
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => {
      initializeWithSelectedVariant();
    }, 100);
  }
  
  // Listen for the theme's variant change event
  document.addEventListener('theme:variant:change', function(event) {
    if (event.detail && event.detail.variant) {
      // Prevent the default scrolling behavior
      if (event.preventDefault) {
        event.preventDefault();
      }
      
      // Store current scroll position
      const currentScrollPos = window.scrollY;
      
      const productJsonScript = document.querySelector('[data-product-json]');
      if (productJsonScript) {
        try {
          const productData = JSON.parse(productJsonScript.textContent);
          
          // Check if we're in mobile or desktop mode
          const isMobile = window.innerWidth < 768;
          
          if (isMobile) {
            filterImagesForMobile(event.detail.variant, productData);
          } else {
            filterImagesForDesktop(event.detail.variant, productData, false);
          }
          
          // Restore scroll position after filtering
          setTimeout(() => {
            window.scrollTo(0, currentScrollPos);
          }, 100);
        } catch (e) {
          console.error('Error parsing product JSON:', e);
        }
      }
    }
  });
  
  // Function to initialize filtering with the initially selected variant
  function initializeWithSelectedVariant() {
    const productJsonScript = document.querySelector('[data-product-json]');
    if (!productJsonScript) return;
    
    try {
      const productData = JSON.parse(productJsonScript.textContent);
      
      // Get the initially selected variant
      const selectedVariantId = document.querySelector('[name="id"]')?.value;
      
      if (selectedVariantId) {
        const selectedVariant = productData.variants.find(v => v.id.toString() === selectedVariantId.toString());
        
        if (selectedVariant) {
          // Check if we're in mobile or desktop mode
          const isMobile = window.innerWidth < 768;
          
          if (isMobile) {
            filterImagesForMobile(selectedVariant, productData);
          } else {
            filterImagesForDesktop(selectedVariant, productData, true);
          }
        }
      } else {
        // If no variant is explicitly selected, use the first available variant
        if (productData.variants && productData.variants.length > 0) {
          // Check if we're in mobile or desktop mode
          const isMobile = window.innerWidth < 768;
          
          if (isMobile) {
            filterImagesForMobile(productData.variants[0], productData);
          } else {
            filterImagesForDesktop(productData.variants[0], productData, true);
          }
        }
      }
    } catch (e) {
      console.error('Error parsing product JSON on page load:', e);
    }
  }

  // Helper function to get the color option name from product data
  function getColorOptionName(productData) {
    if (!productData || !productData.options) return null;
    
    // Look for option names containing 'color' or 'colour'
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex !== -1) {
      return productData.options[colorOptionIndex];
    }
    
    return null;
  }

  // Function specifically for mobile filtering
  function filterImagesForMobile(variant, productData) {
    console.log('Mobile filtering started for variant:', variant);
    
    // 1. Find the color option index and value
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex === -1) {
      console.log('No color option found');
      return; // No color option found
    }
    
    const selectedColor = variant.options[colorOptionIndex].toLowerCase();
    console.log('Selected color:', selectedColor);
    
    if (!selectedColor) return;
    
    // 2. Get the slideshow container and check mobile style
    const slideshowContainer = document.querySelector('[data-product-slideshow]');
    if (!slideshowContainer) {
      console.log('No slideshow container found');
      return;
    }
    
    const mobileStyle = slideshowContainer.getAttribute('data-slideshow-mobile-style');
    if (mobileStyle !== 'carousel') {
      console.log('Not a carousel mobile style:', mobileStyle);
      return;
    }
    
    // 3. Get all slides
    const allSlides = slideshowContainer.querySelectorAll('.product__media');
    if (!allSlides.length) {
      console.log('No slides found');
      return;
    }
    console.log('Total slides found:', allSlides.length);
    
    // 4. Check if Flickity exists and destroy it
    let flkty = null;
    if (typeof Flickity !== 'undefined') {
      flkty = Flickity.data(slideshowContainer);
      if (flkty) {
        console.log('Destroying existing Flickity instance');
        flkty.destroy();
      }
    }
    
    // 5. Create a temporary container to hold slides we want to keep
    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);
    
    // 6. Move all slides to the temporary container
    const slidesArray = Array.from(allSlides);
    slidesArray.forEach(slide => {
      tempContainer.appendChild(slide);
    });
    
    // 7. Filter slides based on alt text containing the color name
    const matchingSlides = slidesArray.filter(slide => {
      const img = slide.querySelector('img');
      if (!img) return false;
      
      const altText = (img.getAttribute('alt') || '').toLowerCase();
      
      // Check for #color format in alt text
      if (altText.includes('#')) {
        const parts = altText.split('#');
        if (parts.length > 1) {
          const colorPart = parts[1].split(' ')[0].toLowerCase();
          console.log('Color part from alt:', colorPart, 'comparing with:', selectedColor);
          return colorPart === selectedColor || colorPart === 'all';
        }
      }
      
      // If no specific color format is found, include the slide
      return true;
    });
    
    console.log('Matching slides found:', matchingSlides.length);
    
    // If no matching slides, show all slides
    const slidesToShow = matchingSlides.length > 0 ? matchingSlides : slidesArray;
    
    // 8. Add filtered slides back to the slideshow container
    slidesToShow.forEach(slide => {
      slideshowContainer.appendChild(slide);
    });
    
    // 9. Remove the temporary container
    document.body.removeChild(tempContainer);
    
    // 10. Trigger a resize event to make the theme reinitialize the slider
    setTimeout(() => {
      // Dispatch a resize event to force the theme to reinitialize Flickity
      window.dispatchEvent(new Event('resize'));
      
      // Also dispatch a custom event that the theme might be listening for
      slideshowContainer.dispatchEvent(new CustomEvent('product:slider:reload'));
      
      console.log('Events dispatched to reinitialize slider');
    }, 100);
  }

  // Function specifically for desktop filtering
  function filterImagesForDesktop(variant, productData, isInitialLoad = false) {
    if (!variant || !productData) return;

    // Find the color option index
    const colorOptionIndex = productData.options.findIndex(option => 
      option.toLowerCase().includes('color') || option.toLowerCase().includes('colour'));
    
    if (colorOptionIndex === -1) return; // No color option found
    
    const selectedColor = variant.options[colorOptionIndex];
    
    if (!selectedColor) return;

    // Get the slideshow container
    const slideshowContainer = document.querySelector('[data-product-slideshow]');
    
    if (!slideshowContainer) return;

    // Get all media slides and thumbs
    const mediaSlides = document.querySelectorAll('[data-media-slide]');
    const thumbs = document.querySelectorAll('[data-slideshow-thumbnail]');
    
    if (!mediaSlides.length) return;

    let hasVisibleSlides = false;
    let firstVisibleSlide = null;
    let visibleSlideCount = 0;

    // Create arrays to hold visible and hidden slides
    const visibleSlides = [];
    const hiddenSlides = [];

    // Filter media slides based on EXACT alt text match only
    mediaSlides.forEach((slide) => {
      const altText = slide.getAttribute('aria-label') || '';
      const exactMatch = altText === selectedColor;
      
      if (exactMatch) {
        // Add to visible slides array
        visibleSlides.push(slide);
        // Show matching slides
        slide.style.display = '';
        slide.classList.remove('hide');
        hasVisibleSlides = true;
        visibleSlideCount++;
        if (!firstVisibleSlide) {
          firstVisibleSlide = slide;
        }
      } else {
        // Add to hidden slides array
        hiddenSlides.push(slide);
        // Hide non-matching slides
        slide.style.display = 'none';
        slide.classList.add('hide');
      }
    });
    
    // If no slides match the color, show all slides (fallback)
    if (visibleSlideCount === 0) {
      // Reset arrays
      visibleSlides.length = 0;
      hiddenSlides.length = 0;
      
      // Add all slides to visible array and show them
      mediaSlides.forEach(slide => {
        visibleSlides.push(slide);
        slide.style.display = '';
        slide.style.visibility = 'visible';
        slide.style.position = 'relative';
        slide.classList.remove('hide');
      });
      
      if (thumbs.length) {
        thumbs.forEach(thumb => {
          thumb.style.display = '';
        });
      }
    } else {
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
    }
    
    // Check if we need to rebuild the desktop slideshow
    const desktopStyle = slideshowContainer.getAttribute('data-slideshow-desktop-style');
    
    if (desktopStyle === 'slideshow') {
      // For slideshow style, update the Flickity instance
      if (typeof Flickity !== 'undefined') {
        const flkty = Flickity.data(slideshowContainer);
        if (flkty) {
          // Just resize and select the first visible slide
          setTimeout(() => {
            flkty.resize();
            
            // If we have a visible slide, select it
            // But ONLY if this is not the initial page load
            if (firstVisibleSlide && hasVisibleSlides && !isInitialLoad) {
              const slideIndex = Array.from(slideshowContainer.children).indexOf(firstVisibleSlide);
              if (slideIndex >= 0) {
                flkty.select(slideIndex);
              }
            }
          }, 100);
        }
      }
    } else {
      // For grid or other non-slideshow modes, we need to rearrange the DOM
      // to ensure visible slides appear first
      
      // Remove all slides from the DOM
      mediaSlides.forEach(slide => {
        slide.remove();
      });
      
      // Add visible slides back first, then hidden slides
      visibleSlides.forEach(slide => {
        slideshowContainer.appendChild(slide);
      });
      
      hiddenSlides.forEach(slide => {
        slideshowContainer.appendChild(slide);
      });
      
      // If we have a first visible slide, select it
      // But ONLY if this is not the initial page load
      if (firstVisibleSlide && !isInitialLoad) {
        const mediaId = firstVisibleSlide.getAttribute('data-media-id');
        if (mediaId) {
          // Store current scroll position
          const originalScrollPos = window.scrollY;
          
          // Dispatch the event to change the image
          slideshowContainer.dispatchEvent(new CustomEvent('theme:image:change', {
            detail: {
              id: mediaId
            }
          }));
          
          // Immediately restore the scroll position
          setTimeout(() => {
            window.scrollTo(0, originalScrollPos);
          }, 10);
        }
      }
    }
  }
})(); 