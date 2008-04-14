/*
 * SimpleModal @VERSION - jQuery Plugin
 * http://www.ericmmartin.com/projects/simplemodal/
 * http://plugins.jquery.com/project/SimpleModal
 * http://code.google.com/p/simplemodal/
 *
 * Copyright (c) 2008 Eric Martin - http://ericmmartin.com
 * Idea/inspiration/code contributions from:
 *     - jQuery UI Dialog
 *     - Aaron Barker
 *
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Revision: $Id$
 *
 */

 /* TODO -
 *
 * - prevent tabbing for modal dialog
 * - test external calls
 * - test var x = xxx.modal(), etc
 * - styles
 * - IE6 fixes/iframe (bgiframe?)
 * - modal positioning
 * - close button/link?
 * - persistance / save original dom element
 * - iframe support?
 * - click anywhere to close for non-modal dialogs
 * - ajax stuff... load dialog then content?
 * - esc key && dealing w/ multiple dialogs
 */
(function ($) {

	// private variables
	var smid = 0, wProps = [], zIndex = 1;
	var ie6 = $.browser.msie && /MSIE 6.0/.test(navigator.userAgent);
	var ie7qm = $.browser.msie && /MSIE 7.0/.test(navigator.userAgent) && !$.boxModel;

	// action function
	$.extend($.fn, {
		modal: function (options) {
			var args = Array.prototype.slice.call(arguments, 1);
			return this.each(function () {
				if (typeof options == 'string') {
					var dialog = $(this).is('.simplemodal-data') ? $.data(this, 'simplemodal') : {};
					if (dialog[options]) {
						dialog[options].apply(dialog, args);
					}
				}
				else if (!$(this).is('.simplemodal-data')) {
					new $.modal.dialog($(this), options);
				}
			});
		}
	});

	// utility function
	$.modal = function (obj, options) {
		var element = null;

		// check for an ajax request - there will only be one argument, which
		// will actually be the options object and it will contain an ajax property
		if (arguments.length == 1 && obj.ajax) {
			options = obj;
			if (!options.ajax && !$.modal.defaults.ajax) {
				alert('problem');
			}
			else {
				$.ajax({
					url: options.ajax || $.modal.defaults.ajax,
					cache: options.cache || $.modal.defaults.cache,
					method: options.method || $.modal.defaults.method,
					dataType: options.dataType || $.modal.defaults.dataType,
					error: function (event, xhr) {
						alert(xhr.responseText);
					},
					success: function (data) {
						// wrap in a div for safe parsing
						element = $('<div/>').append(data);

						// call the action function
						return element.modal(options);
					}
				});
			}
		}
		else {
			// determine the datatype for content and handle accordingly
			if (typeof obj == 'object') {
				// convert to a jQuery object, if necessary
				element = obj instanceof jQuery ? obj : $(obj);
			}
			else if (typeof obj == 'string' || typeof obj == 'number') {
				// just insert the content as innerHTML
				element = $('<div/>').html(obj);
			}
			else {
				// unsupported data type
				window.console && console.log('SimpleModal Error: Unsupported data type: ' + typeof obj);
				return false;
			}

			// call the action function
			return element.modal(options);
		}
	};

	$.modal.defaults = {
		/* Callback functions */
		onOpen: null,			// called after the dialog elements are created - usually used for custom opening effects
		onShow: null,			// called after the dialog is opened - usually used for binding events to the dialog
		onClose: null,			// called when the close event is fired - usually used for custom closing effects
		/* Ajax options (see: http://docs.jquery.com/Ajax/jQuery.ajax#options) */
		ajax: null,				// ajax url
		cache: false,
		method: 'GET',
		dataType: 'html',
		/* Options */
		autoOpen: true,		// open when instantiated or open after 'open' call
		autoDestroy: true,	// destroy/remove SimpleModal elements from DOM when closed
		position: 'center',	// position of the dialog
		modal: true,			// modal add overlay and prevents tabbing away from dialog
		persist: false,		// elements taken from the DOM will be re-inserted with changes made
		zIndex: null,			// the starting z-index value
		/* Element ID's */
		overlayId: null,		// if not provided, a unique id (simplemodal-overlay-#) will be generated
		dataId: null,			// if not provided, a unique id (simplemodal-data-#) will be generated
		iframeId: null,		// if not provided, a unique id (simplemodal-ifram-#) will be generated
		/* CSS */
		overlayCss: null,
		dataCss: null,
		iframeCss: null
	};
	
	$.modal.overlayCss = {
		background: '#000',
		left: 0,
		opacity: .6,
		position: 'fixed',
		top: 0
	};
	
	$.modal.dataCss = {
		background: '#fff',
		left: 0,
		position: 'fixed',
		top: 0
	};
	
	$.modal.iframeCss = {
		left: 0,
		opacity: 0,
		position: 'absolute',
		top: 0
	};

	$.modal.dialog = function (element, options) {
		// alias this
		var self = this;

		// merge user options with the defaults
		this.options = $.extend({}, $.modal.defaults, options);

		// store this dialog for later use
		$.data(element[0], 'simplemodal', this);

		// set flags for callbacks - to prevent recursion
		this.oocb = this.oscb = this.occb = false;

		// get a unique id
		var uid = ++smid;
		
		// set z-index
		if (!options || (options && !options.zIndex)) {
			zIndex = uid * 1000;
		}
		
		// set the window properties
		wProps = _getDimensions($(window));
		
		// create the iframe for ie6
		if (ie6) {
			this.iframe = $('<iframe src="javascript:false;"/>')
				.attr('id', this.options.iframeId || 'simplemodal-iframe-' + uid)
				.addClass('simplemodal-iframe')
				.css($.extend({
						display: 'none',
						zIndex: zIndex
					},
					$.modal.iframeCss,
					this.options.iframeCss
				))
				.appendTo('body');
		}

		// create the overlay
		this.overlay = $('<div/>')
			.attr('id', this.options.overlayId || 'simplemodal-overlay-' + uid)
			.addClass('simplemodal-overlay')
			.css($.extend({
					display: 'none',
					height: wProps[1],
					width: wProps[0],
					zIndex: zIndex + 1
				},
				$.modal.overlayCss,
				this.options.overlayCss
			))
			.appendTo('body');

		this.data = element;
		
		// did the element come from the DOM
		if (element.show()[0].offsetParent) {
			// hide it
			element.hide();
			
			// keep track of parent element
			this.parent = element.parent();
	
			// persist changes? if not, make a clone of the element
			if (!this.options.persist) {
				this.original = element.clone(true);
			}
		}
		else {
			// hide the element
			element.hide();
			
			// add it to the dom
			element.appendTo('body');
		}

		// add styling and attributes to the data
		this.data
			.attr('id', element.attr('id') || this.options.dataId || 'simplemodal-data-' + uid)
			.addClass('simplemodal-data')
			.css($.extend({
					display: 'none',
					zIndex: zIndex + 2
				},
				$.modal.dataCss,
				this.options.dataCss
			));

		// TODO - position data element
		_setPosition(this.options.position, this.data);

		// open the dialog if autoOpen is true
		this.options.autoOpen && this.open();
		
		// TODO - bind events here?
		this.overlay.bind('click.' + this.overlay.attr('id'), function (e) {
			e.preventDefault();
			self.close();
		});
		this.data.find('.simplemodal-close').bind('click.' + this.data.attr('id'), function (e) {
			e.preventDefault();
			self.close();
		});
		
		// TODO - handle multiple dialogs?
		$().bind('keydown.esc-' + this.overlay.attr('id'), function (e) {if (e.keyCode == 27) {self.close();}});
		
		// update window size
		$(window).bind('resize.' + this.overlay.attr('id'), function () {
			// redetermine the window width/height
			wProps = _getDimensions($(window));
			
			// reposition the dialog
			_setPosition(self.options.position, self.data);
			
			// update the overlay and iframe for ie6
			ie6 && _fixIE6(self);
		});
	};

	$.extend($.modal.dialog.prototype, {
		open: function () {
			var self = this;
			
			// perform ie6 fixes
			ie6 && _fixIE6(self);
			
			// perform ie7 quirksmode fixes
			ie7qm && _fixIE7([self.overlay, self.data]);

			// check for onOpen callback
			if ($.isFunction(self.options.onOpen) && !self.oocb) {
				self.oocb = true;
				self.options.onOpen.apply(self, [self]);
			}
			else {
				self.iframe && self.iframe.show();
				self.overlay.show();
				self.data.show();
			}

			// check for onShow callback
			if ($.isFunction(self.options.onShow) && !self.oscb) {
				self.oscb = true;
				self.options.onShow.apply(self, [self]);
			}
			else {
				// TODO - bind events here?
			}
		},
		close: function () {
			var self = this;

			// check for onClose callback
			if ($.isFunction(self.options.onClose) && !self.occb) {
				self.occb = true;
				self.options.onClose.apply(self, [self]);
			}
			else {
				self.data.hide();
				self.overlay.hide();
				self.iframe && self.iframe.hide();
				self.options.autoDestroy && self.destroy();
			}
		},
		destroy: function () {
			$.removeData(this.data[0], 'simplemodal');

			// TODO - unbinding events
			this.overlay.unbind('click.' + this.overlay.attr('id'));
			this.data.find('.simplemodal-close').unbind('click.' + this.data.attr('id'));
			$(window).unbind('resize.' + this.overlay.attr('id'));
			$().unbind('keydown.esc-' + this.overlay.attr('id'));

			this.iframe && this.iframe.remove();
			this.overlay.remove();

			// save changes to the data?
			if (this.parent) {
				if (this.options.persist) {
					// insert the (possibly) modified data back into the DOM
					this.data.appendTo(this.parent);
				}
				else {
					// remove the current and insert the original,
					// unmodified data back into the DOM
					this.data.remove();
					this.original.appendTo(this.parent);
				}
			}
			else {
				this.data.remove();
			}
		}
	});
	
	// private functions
	function _setPosition (pos, el) {
		if (pos === 'center') {
			var elProps = _getDimensions(el);
			el.css({left: (wProps[0]/2) - (elProps[0]/2), top: (wProps[1]/2) - (elProps[1]/2)});
		}
		else {
			el.css({left: pos[0], top: pos[1]});
		}
	}
	
	function _fixIE6 (dialog) {
		dialog.iframe.css({height: wProps[1], width: wProps[0]});
		dialog.overlay.css({height: wProps[1], position: 'absolute', width: wProps[0]});
		dialog.data.css({position: 'absolute'});
	}
	
	function _fixIE7 (els) {
		$.each(els, function (i, el) {
			el.css({position: 'absolute'});
		});
	}
	
	function _getDimensions (el) {
		return [el.width(), el.height()];
	}
})(jQuery);