const template = document.createElement('template');
template.innerHTML = `
  <style>
    #animatics_slideshow {
        position: relative;
        width: 600px;
        height: 360px;
        background-color: #292929;
        border: 22px solid #191919;
        overflow: hidden;
    }

    .animatics-slide {
        position: absolute;
        z-index: 1;
        opacity: 1;
    }

    .animatics-slide img {
        position: relative;
        -webkit-transform: translate3d(0, 0, 0);
        -moz-transform: translate3d(0, 0, 0);
        -webkit-backface-visibility: hidden;
        -moz-backface-visibility: hidden;
    }

    /* https://codepen.io/MoOx/pen/grXZRQ/ */
    .loader {
        display: flex;
        height: 50vh;
        justify-content: center;
        align-items: center;
      }
      
      .spinner {
        height: 5vh;
        width: 5vh;
        border: 6px solid rgba(0, 174, 239, 0.2);
        border-top-color: rgba(0, 174, 239, 0.8);
        border-radius: 100%;
        animation: rotation 0.6s infinite linear 0.25s;
      
        /* the opacity is used to lazyload the spinner, see animation delay */
        /* this avoid the spinner to be displayed when visible for a very short period of time */
        opacity: 0;
      }
      
      @keyframes rotation {
        from {
          opacity: 1;
          transform: rotate(0deg);
        }
        to {
          opacity: 1;
          transform: rotate(359deg);
        }
      }
  </style>
  <div id="animatics_slideshow"></div>
`;

export class Animatics extends HTMLElement {
    set options(options) {
        this._options = Object.assign(this._options, options);
        console.log(this._options);
    }
    static get observedAttributes() { return ['duration', 'fadespeed', 'scale', 'ease3d']; }

    attributeChangedCallback(attrName, oldValue, newValue) {
        switch (attrName) {
            case 'duration':
                this._options.duration = parseInt(newValue, 10);
                break;
            case 'fadespeed':
                this._options.fadeSpeed = parseInt(newValue, 10);
                break;
            case 'scale':
                this._options.scale = parseFloat(newValue);
                break;
            case 'ease3d':
                this._options.ease3d = newValue;
                break;
        }
    }

    constructor() {
        super();

        this._imagesObj = [];
        this._currentSlide = 0;

        // https://websemantics.uk/articles/transform3d-support-detection/
        this._hasTransform3d = (function () {
            var d = document,
                el = d.createElement('p'),
                property = "transform",
                has3d = "none";
            if (window.getComputedStyle) {
                d.body.insertBefore(el, null);
                if (el.style[property] !== undefined) {
                    el.style[property] = 'translate3d(1px, 1px, 1px)';
                    has3d = window.getComputedStyle(el).getPropertyValue(property);
                }
                d.body.removeChild(el);
            }
            return (has3d !== undefined && has3d.length > 0 && has3d !== "none");
        }());

        this._defaults = {
            images: [],
            duration: 6000,
            fadeSpeed: 500,
            scale: 0.75,
            ease3d: 'cubic-bezier(0.445, 0.050, 0.550, 0.950)',
            onLoadingComplete: function () { },
            onSlideComplete: function () { },
            onListComplete: function () { },
            getSlideIndex: function () {
                return currentSlide;
            }
        };
        this._options = Object.assign({}, this._defaults);
        this._options.images = Array.prototype.slice.call(this.querySelectorAll("img"));
        this.innerHTML = '';
        this._maxSlides = this._options.images.length;

        this.root = this.attachShadow({ mode: 'open' });
        this.root.appendChild(template.content.cloneNode(true));

        this.animaticsSlideshowElement = this.root.querySelector('#animatics_slideshow');

    }

    connectedCallback() {
        this.init();
    }

    init() {
        this._options.images.forEach(function (element, index, array) {
            this._imagesObj["image" + index] = {};
            this._imagesObj["image" + index].loaded = false;
            this.attachImage(element, index);
        }, this);

        var loader = document.createElement("div");
        loader.setAttribute("class", "loader");
        var spinner = document.createElement("div");
        spinner.setAttribute("class", "spinner");
        loader.prepend(spinner);
        loader.style["position"] = 'absolute';
        loader.style["zIndex"] = '10000';
        this.root.prepend(loader);
        this._loader = loader;
    }

    attachImage(image, index) {
        var wrapper = document.createElement("div");
        wrapper.setAttribute("class", "animatics-slide");
        wrapper.setAttribute("opacity", "0");
        wrapper.appendChild(image);
        if (this._hasTransform3d) {
            image.style["-webkit-transform-origin"] = 'left top';
            image.style["-moz-transform-origin"] = 'left top';
            image.style["-webkit-transform"] = 'scale(' + this._options.scale + ') translate3d(0,0,0)';
            image.style["-moz-transform"] = 'scale(' + this._options.scale + ') translate3d(0,0,0)';
        }

        image.onload = () => {
            this._imagesObj["image" + index].element = image;
            this._imagesObj["image" + index].loaded = true;
            this._imagesObj["image" + index].width = image.width;
            this._imagesObj["image" + index].width = image.height;
            this.insertChildAtIndex(this.animaticsSlideshowElement, wrapper, index);
            this.resume(index);
        };
    }

    insertChildAtIndex(parent, child, index) {
        if (!index) index = 0;
        if (index >= parent.children.length) {
            parent.appendChild(child);
        } else {
            parent.insertBefore(child, parent.children[index]);
        }
    }

    resume(index) {
        if (index == 0) {
            this.startTransition(0);
            var loaders = this.root.querySelectorAll('.loader'), i;
            this._loader.style.display = "none";
        }

        if (index == this._holdup) {
            this._loader.style.display = "none";
            this.startTransition(this._holdup);
        }

        if (this.checkLoadProgress() == true) {
            if (typeof this._options.onLoadingComplete === "function") { this._options.onLoadingComplete() };
        }
    }

    checkLoadProgress() {
        var imagesLoaded = this._imagesObj.every(function (e) {
            return e.loaded == true;
        });
        return imagesLoaded;
    }

    wait() {
        clearInterval(this._interval);
        var loaders = this.root.querySelectorAll('.loader'), i;
        this._loader.style.display = "block";
    }

    startTransition(startIndex) {
        this._currentSlide = startIndex;
        this.transition3d();
        this._interval = setInterval(() => {

            if (this._currentSlide < this._maxSlides - 1) {
                this._currentSlide++;
            } else {
                this._currentSlide = 0;
            }

            if (this._imagesObj["image" + this._currentSlide].loaded == false) {
                this._holdup = this._currentSlide;
                this.wait();
            } else {
                this.transition3d();
            }

        }, this._options.duration);
    }

    transition3d(startIndex) {
        var scale = this._options.scale;
        var image = this._imagesObj["image" + this._currentSlide].element;
        var position = this.chooseCorner();

        //First clear any existing transition
        image.style['-webkit-transition'] = 'none';
        image.style['-moz-transition'] = 'none';
        image.style['-webkit-transform'] = 'scale(' + scale + ') translate3d(' + position.startX + 'px,' + position.startY + 'px,0)';
        image.style['-moz-transform'] = 'scale(' + scale + ') translate3d(' + position.startX + 'px,' + position.startY + 'px,0)';

        //Add the transition back in
        image.style['-webkit-transition'] = '-webkit-transform ' + (this._options.duration + this._options.fadeSpeed) + 'ms ' + this._options.ease3d;
        image.style['-moz-transition'] = '-moz-transform ' + (this._options.duration + this._options.fadeSpeed) + 'ms ' + this._options.ease3d;

        //set the end position and scale, which fires the transition
        image.style['-webkit-transform'] = 'scale(1) translate3d(' + position.endX + 'px,' + position.endY + 'px,0)';
        image.style['-moz-transform'] = 'scale(1) translate3d(' + position.endX + 'px,' + position.endY + 'px,0)';

        image.parentElement.style["zIndex"] = '3';
        image.parentElement.style["opacity"] = '0';
        image.parentElement.style["transition"] = "opacity 3s ease-in-out";
        image.parentElement.style["opacity"] = '1';
        setTimeout(function () { image.parentElement.style["zIndex"] = '1'; image.parentElement.style["opacity"] = '0'; }, this._options.duration + this._options.fadeSpeed);

        if (typeof this._options.onSlideComplete === "function") { this._options.onSlideComplete() };
    }

    chooseCorner(startIndex) {
        var scale = this._options.scale;
        var image = this._imagesObj["image" + this._currentSlide].element;

        var ratio = image.height / image.width;
        var sw = Math.floor(this.animaticsSlideshowElement.clientWidth * (1 / scale));
        var sh = Math.floor(this.animaticsSlideshowElement.clientWidth * ratio * (1 / scale));

        image.width = sw;
        image.height = sh;

        var w = this.animaticsSlideshowElement.clientWidth;
        var h = this.animaticsSlideshowElement.clientHeight;

        var corners = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 }
        ];

        var choice = Math.floor(Math.random() * 4);
        var start = corners[choice];

        corners.splice(choice, 1);
        var end = corners[Math.floor(Math.random() * 3)];

        var coordinates = {
            startX: start.x * (w - sw * scale),
            startY: start.y * (h - sh * scale),
            endX: end.x * (w - sw),
            endY: end.y * (h - sh)
        }

        return coordinates;
    }
}

customElements.define('x-animatics', Animatics);