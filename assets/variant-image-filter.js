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
    // Get all slides in the product grid
    const productGrid = document.querySelector('[data-product-slideshow]');
    if (!productGrid) return;
    
    // Get the mobile style
    const mobileStyle = productGrid.getAttribute('data-slideshow-mobile-style');
    if (!mobileStyle || mobileStyle !== 'carousel') return;
    
    // Get the color option name and value
    const colorOptionName = getColorOptionName(productData);
    if (!colorOptionName) return;
    
    const variantColor = variant.options.find((option, index) => 
      productData.options[index].toLowerCase() === colorOptionName.toLowerCase()
    );
    
    if (!variantColor) return;
    
    // Get all slides
    const allSlides = productGrid.querySelectorAll('.product__media');
    if (!allSlides.length) return;
    
    // Find the Flickity instance
    let flickityInstance = Flickity.data(productGrid);
    
    // If Flickity exists, destroy it first
    if (flickityInstance) {
      flickityInstance.destroy();
    }
    
    // Remove all slides from the DOM temporarily
    const slidesContainer = productGrid;
    const slidesArray = Array.from(allSlides);
    const slidesParent = allSlides[0].parentNode;
    
    // Remove all slides from the DOM
    slidesArray.forEach(slide => {
      slidesParent.removeChild(slide);
    });
    
    // Filter slides that match the variant color
    const visibleSlides = slidesArray.filter(slide => {
      const slideImage = slide.querySelector('img');
      if (!slideImage) return false;
      
      const altText = slideImage.getAttribute('alt') || '';
      // Check if alt text contains the color option
      if (altText.includes('#')) {
        const altParts = altText.split('#');
        if (altParts.length > 1) {
          const colorPart = altParts[1].split(' ')[0].toLowerCase();
          return colorPart === variantColor.toLowerCase() || colorPart === 'all';
        }
      }
      return true; // If no alt text filter, show the slide
    });
    
    // Add visible slides back to the DOM
    visibleSlides.forEach(slide => {
      slidesParent.appendChild(slide);
    });
    
    // Initialize Flickity with mobile options
    setTimeout(() => {
      // Create mobile options
      const mobileOptions = {
        cellAlign: 'left',
        contain: false,
        draggable: '>1',
        prevNextButtons: true,
        pageDots: true,
        adaptiveHeight: false,
        wrapAround: false,
        friction: 0.8,
        selectedAttraction: 0.2,
        autoPlay: false
      };
      
      // Initialize Flickity with the mobile options
      new Flickity(productGrid, mobileOptions);
      
      // Select the first slide
      const newFlickityInstance = Flickity.data(productGrid);
      if (newFlickityInstance) {
        newFlickityInstance.select(0, false, true);
        
        // Dispatch event to update the image
        const firstVisibleSlide = productGrid.querySelector('.product__media');
        if (firstVisibleSlide) {
          const mediaId = firstVisibleSlide.getAttribute('data-media-id');
          if (mediaId) {
            const event = new CustomEvent('mediaVisible', {
              detail: {
                mediaId: mediaId
              }
            });
            document.dispatchEvent(event);
          }
        }
      }
    }, 10);
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