﻿import pageCommon = require("./page-common");
import definition = require("ui/page");
import {View} from "ui/core/view";
import trace = require("trace");
import uiUtils = require("ui/utils");
import utils = require("utils/utils");
import {device} from "platform";
import {DeviceType} from "ui/enums";

global.moduleMerge(pageCommon, exports);
var ENTRY = "_entry";

function isBackNavigation(frame: any, entry): boolean {
    if (!frame) {
        return false;
    }

    if (frame._navigationQueue.length === 0) {
        return true;
    }
    else {
        var navigationQueue = frame._navigationQueue;
        for (var i = 0; i < navigationQueue.length; i++) {
            if (navigationQueue[i].entry === entry) {
                return navigationQueue[i].isBackNavigation;
            }
        }
    }

    return false;
}

class UIViewControllerImpl extends UIViewController {

    private _owner: WeakRef<Page>;

    public static initWithOwner(owner: WeakRef<Page>): UIViewControllerImpl {
        let controller = <UIViewControllerImpl>UIViewControllerImpl.new();
        controller._owner = owner;
        controller.automaticallyAdjustsScrollViewInsets = false;
        return controller;
    }

    public viewDidLayoutSubviews() {
        let owner = this._owner.get();
        if (!owner) {
            return;
        }

        trace.write(owner + " viewDidLayoutSubviews, isLoaded = " + owner.isLoaded, trace.categories.ViewHierarchy);
        if (!owner.isLoaded) {
            return;
        }

        if (owner._modalParent) {
            let isTablet = device.deviceType === DeviceType.Tablet;
            let isFullScreen = !owner._UIModalPresentationFormSheet || !isTablet;
            let frame = isFullScreen ? UIScreen.mainScreen().bounds : this.view.frame;
            let size = frame.size;
            let width = size.width;
            let height = size.height;
            let mode: number = utils.layout.EXACTLY;

            let superViewRotationRadians;
            if (this.view.superview) {
                let transform = this.view.superview.transform;
                superViewRotationRadians = atan2f(transform.b, transform.a);
            }

            if (utils.ios.MajorVersion < 8 && utils.ios.isLandscape() && !superViewRotationRadians) {
                // in iOS 7 when in landscape we switch width with height because on device they don't change even when rotated.
                width = size.height;
                height = size.width;
            }

            let bottom = height;
            let statusBarHeight = uiUtils.ios.getStatusBarHeight();
            let statusBarVisible = !UIApplication.sharedApplication().statusBarHidden;
            let backgroundSpanUnderStatusBar = owner.backgroundSpanUnderStatusBar;
            if (statusBarVisible && !backgroundSpanUnderStatusBar) {
                height -= statusBarHeight;
            }

            let widthSpec = utils.layout.makeMeasureSpec(width, mode);
            let heightSpec = utils.layout.makeMeasureSpec(height, mode);

            View.measureChild(null, owner, widthSpec, heightSpec);
            let top = ((backgroundSpanUnderStatusBar && isFullScreen) || utils.ios.MajorVersion < 8 || !isFullScreen) ? 0 : statusBarHeight;
            View.layoutChild(null, owner, 0, top, width, bottom);

            if (utils.ios.MajorVersion < 8) {
                if (!backgroundSpanUnderStatusBar && (!isTablet || isFullScreen)) {
                    if (utils.ios.isLandscape() && !superViewRotationRadians) {
                        this.view.center = CGPointMake(this.view.center.x - statusBarHeight, this.view.center.y);
                    }
                    else {
                        this.view.center = CGPointMake(this.view.center.x, this.view.center.y + statusBarHeight);
                    }
                }
            }

            trace.write(owner + ", native frame = " + NSStringFromCGRect(this.view.frame), trace.categories.Layout);
        }
        else {
            owner._updateLayout();
        }
    }

    public viewWillAppear(animated: boolean): void {
        let page = this._owner.get();
        trace.write(page + " viewWillAppear", trace.categories.Navigation);
        if (!page) {
            return;
        }

        let frame = this.navigationController ? (<any>this.navigationController).owner : null;
        let newEntry = this[ENTRY];

        // Don't raise event if currentPage was showing modal page.
        if (!page.modal && newEntry && (!frame || frame.currentPage !== page)) {
            let isBack = isBackNavigation(frame, newEntry)
            page.onNavigatingTo(newEntry.entry.context, isBack);
        }

        if (frame) {
            if (!page.parent) {
                if (!frame._currentEntry) {
                    frame._currentEntry = newEntry;
                } else {
                    frame._navigateToEntry = newEntry;
                }

                frame._addView(page);
                frame.remeasureFrame();
            } else if (page.parent !== frame) {
                throw new Error("Page is already shown on another frame.");
            }

            page.actionBar.update();
        }

        //https://github.com/NativeScript/NativeScript/issues/1201
        page._viewWillDisappear = false;

        page._enableLoadedEvents = true;
        // If page was in backstack or showing modal page it will have parent but it will be in unloaded state so raise loaded here.
        if (!page.isLoaded) {
            page.onLoaded();
        }

        page._enableLoadedEvents = false;
    }

    public viewDidAppear(animated: boolean): void {
        let page = this._owner.get();
        trace.write(page + " viewDidAppear", trace.categories.Navigation);
        if (!page) {
            return;
        }

        //https://github.com/NativeScript/NativeScript/issues/1201
        page._viewWillDisappear = false;

        let frame = this.navigationController ? (<any>this.navigationController).owner : null;
        // Skip navigation events if modal page is shown.
        if (!page.modal && frame) {
            let newEntry = this[ENTRY];
            let isBack = isBackNavigation(frame, newEntry);
            // We are on the current page which happens when navigation is canceled so isBack should be false.
            if (frame.currentPage === page && frame._navigationQueue.length === 0) {
                isBack = false;
            }

            frame._navigateToEntry = null;
            frame._currentEntry = newEntry;
            frame.remeasureFrame();
            frame._updateActionBar(page);

            page.onNavigatedTo(isBack);
            frame._processNavigationQueue(page);
        }
    };

    public viewWillDisappear(animated: boolean): void {
        let page = this._owner.get();
        trace.write(page + " viewWillDisappear", trace.categories.Navigation);
        if (!page) {
            return;
        }

        var frame = page.frame;
        // Skip navigation events if we are hiding because we are about to show modal page.
        if (!page.modal && frame && frame.currentPage === page) {
            var isBack = page.frame && (!this.navigationController || !this.navigationController.viewControllers.containsObject(this));
            page.onNavigatingFrom(isBack);
        }

        //https://github.com/NativeScript/NativeScript/issues/1201
        page._viewWillDisappear = true;
    }

    public viewDidDisappear(animated: boolean): void {
        let page = this._owner.get();
        trace.write(page + " viewDidDisappear", trace.categories.Navigation);
        // Exit if no page or page is hiding because it shows another page modally.
        if (!page || page.modal) {
            return;
        }

        let modalParent = page._modalParent;
        page._modalParent = undefined;
        page._UIModalPresentationFormSheet = false;

        // Clear modal flag on parent page.
        if (modalParent) {
            modalParent._modal = undefined;
        }

        // Manually pop backStack when Back button is pressed or navigating back with edge swipe.
        // Don't pop if we are hiding modally shown page.
        let frame = page.frame;
        if (!modalParent && frame && frame.backStack.length > 0 && (<any>frame)._navigationQueue.length === 0 && frame.currentPage === page) {
            (<any>frame)._backStack.pop();
        }

        page._enableLoadedEvents = true;

        // Remove from parent if page was in frame and we navigated back.
        // Showing page modally will not pass isBack check so currentPage won't be removed from Frame.
        let isBack = frame && (!this.navigationController || !this.navigationController.viewControllers.containsObject(this));
        if (isBack) {
            // Remove parent when navigating back.
            frame._removeView(page);
        }

        // Forward navigation does not remove page from frame so we raise unloaded manually.
        if (page.isLoaded) {
            page.onUnloaded();
        }

        page._enableLoadedEvents = false;

        if (!modalParent) {
            // Last raise onNavigatedFrom event if we are not modally shown.
            page.onNavigatedFrom(isBack);
        }
    }
}

export class Page extends pageCommon.Page {
    private _ios: UIViewController;
    public _enableLoadedEvents: boolean;
    public _modalParent: Page;
    public _UIModalPresentationFormSheet: boolean;
    public _viewWillDisappear: boolean;

    constructor(options?: definition.Options) {
        super(options);
        this._ios = UIViewControllerImpl.initWithOwner(new WeakRef(this));
    }

    public requestLayout(): void {
        super.requestLayout();
        if (!this.parent && this.ios && this._nativeView) {
            this._nativeView.setNeedsLayout();
        }
    }

    public _onContentChanged(oldView: View, newView: View) {
        super._onContentChanged(oldView, newView);
        this._removeNativeView(oldView);
        this._addNativeView(newView);
    }

    public onLoaded() {
        // loaded/unloaded events are handled in page viewWillAppear/viewDidDisappear
        if (this._enableLoadedEvents) {
            super.onLoaded();
        }
        this._updateActionBar(false);
    }

    public onUnloaded() {
        // loaded/unloaded events are handled in page viewWillAppear/viewDidDisappear
        if (this._enableLoadedEvents) {
            super.onUnloaded();
        }
    }

    private _addNativeView(view: View) {
        if (view) {
            trace.write("Native: Adding " + view + " to " + this, trace.categories.ViewHierarchy);
            if (view.ios instanceof UIView) {
                this._ios.view.addSubview(view.ios);
            } else if (view.ios instanceof UIViewController) {
                this._ios.addChildViewController(view.ios);
                this._ios.view.addSubview(view.ios.view);
            }
        }
    }

    private _removeNativeView(view: View) {
        if (view) {
            trace.write("Native: Removing " + view + " from " + this, trace.categories.ViewHierarchy);
            if (view.ios instanceof UIView) {
                (<UIView>view.ios).removeFromSuperview();
            } else if (view.ios instanceof UIViewController) {
                (<UIViewController>view.ios).removeFromParentViewController();
                (<UIViewController>view.ios).view.removeFromSuperview();
            }
        }
    }

    get ios(): UIViewController {
        return this._ios;
    }

    get _nativeView(): UIView {
        return this.ios.view;
    }

    protected _showNativeModalView(parent: Page, context: any, closeCallback: Function, fullscreen?: boolean) {
        super._showNativeModalView(parent, context, closeCallback, fullscreen);
        this._modalParent = parent;

        if (!parent.ios.view.window) {
            throw new Error("Parent page is not part of the window hierarchy. Close the current modal page before showing another one!");
        }

        if (fullscreen) {
            this._ios.modalPresentationStyle = UIModalPresentationStyle.UIModalPresentationFullScreen;
        }
        else {
            this._ios.modalPresentationStyle = UIModalPresentationStyle.UIModalPresentationFormSheet;
            this._UIModalPresentationFormSheet = true;
        }

        super._raiseShowingModallyEvent();

        var that = this;
        parent.ios.presentViewControllerAnimatedCompletion(this._ios, utils.ios.MajorVersion >= 8, null);
        UIViewControllerTransitionCoordinator.prototype.animateAlongsideTransitionCompletion.call(parent.ios.transitionCoordinator(), null, function () {
            that._raiseShownModallyEvent(parent, context, closeCallback);
        });
    }

    protected _hideNativeModalView(parent: Page) {
        parent.requestLayout();
        parent._ios.dismissModalViewControllerAnimated(utils.ios.MajorVersion >= 8);

        super._hideNativeModalView(parent);
    }

    public _updateActionBar(hidden: boolean) {
        var frame = this.frame;
        if (frame) {
            frame._updateActionBar(this);
        }
    }

    public onMeasure(widthMeasureSpec: number, heightMeasureSpec: number) {
        let width = utils.layout.getMeasureSpecSize(widthMeasureSpec);
        let widthMode = utils.layout.getMeasureSpecMode(widthMeasureSpec);

        let height = utils.layout.getMeasureSpecSize(heightMeasureSpec);
        let heightMode = utils.layout.getMeasureSpecMode(heightMeasureSpec);

        let actionBarWidth: number = 0;
        let actionBarHeight: number = 0;

        // If background span under statusbar reduce available height for page content.
        let statusBarHeight = this.backgroundSpanUnderStatusBar ? uiUtils.ios.getStatusBarHeight() : 0;

        // If this page is inside nested frame - don't substract statusBarHeight again.
        if (this.frame && this.frame.parent) {
            statusBarHeight = 0;
        }

        // Phones does not support fullScreen=false for modal pages so we reduce statusbar only when on tablet and not in fullscreen
        if (this._modalParent && this._UIModalPresentationFormSheet && device.deviceType === DeviceType.Tablet) {
            statusBarHeight = 0;
        }

        if (this.frame && this.frame._getNavBarVisible(this)) {
            // Measure ActionBar with the full height. 
            let actionBarSize = View.measureChild(this, this.actionBar, widthMeasureSpec, heightMeasureSpec);
            actionBarWidth = actionBarSize.measuredWidth;
            actionBarHeight = actionBarSize.measuredHeight;
        }

        let heightSpec = utils.layout.makeMeasureSpec(height - actionBarHeight - statusBarHeight, heightMode);

        // Measure content with height - navigationBarHeight. Here we could use actionBarSize.measuredHeight probably.
        let result = View.measureChild(this, this.layoutView, widthMeasureSpec, heightSpec);

        let measureWidth = Math.max(actionBarWidth, result.measuredWidth, this.minWidth);
        let measureHeight = Math.max(result.measuredHeight + actionBarHeight, this.minHeight);

        let widthAndState = View.resolveSizeAndState(measureWidth, width, widthMode, 0);
        let heightAndState = View.resolveSizeAndState(measureHeight, height, heightMode, 0);

        this.setMeasuredDimension(widthAndState, heightAndState);
    }

    public onLayout(left: number, top: number, right: number, bottom: number) {
        View.layoutChild(this, this.actionBar, 0, 0, right - left, bottom - top);

        let navigationBarHeight: number = 0;
        if (this.frame && this.frame._getNavBarVisible(this)) {
            navigationBarHeight = this.actionBar.getMeasuredHeight();
        }

        let statusBarHeight = this.backgroundSpanUnderStatusBar ? uiUtils.ios.getStatusBarHeight() : 0;

        // If this page is inside nested frame - don't substract statusBarHeight again.
        if (this.frame && this.frame.parent) {
            statusBarHeight = 0;
        }

        // Phones does not support fullScreen=false for modal pages so we reduce statusbar only when on tablet and not in fullscreen
        if (this._modalParent && this._UIModalPresentationFormSheet && device.deviceType === DeviceType.Tablet) {
            statusBarHeight = 0;
        }

        View.layoutChild(this, this.layoutView, 0, navigationBarHeight + statusBarHeight, right - left, bottom - top);
    }

    public _addViewToNativeVisualTree(view: View): boolean {
        // ActionBar is added to the native visual tree by default
        if (view === this.actionBar) {
            return true;
        }

        return super._addViewToNativeVisualTree(view);
    }
}