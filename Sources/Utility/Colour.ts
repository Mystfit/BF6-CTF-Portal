//==============================================================================================
// COLOR & UTILITY CLASSES
//==============================================================================================

/**
 * RGBA color class with conversion utilities for the mod API.
 * Handles color normalization and conversion to mod.Vector format.
 */
class rgba {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r:number, g:number, b:number, a?:number){
        this.r = r;
        this.g =  g;
        this.b = b;
        this.a = a ? a : 255;
    }

    NormalizeToLinear(): rgba {
        return new rgba(this.r / 255, this.g / 255, this.b / 255, this.a / 255);
    }

    AsModVector3(): mod.Vector {
        return mod.CreateVector(this.r, this.g, this.b);
    }

    static FromModVector3(vector: mod.Vector): rgba {
        return new rgba(mod.XComponentOf(vector), mod.YComponentOf(vector), mod.ZComponentOf(vector));
    }
}

// Colors
const NEUTRAL_COLOR = new rgba(255, 255, 255, 1).NormalizeToLinear().AsModVector3();
const DEFAULT_TEAM_COLOURS = new Map<number, mod.Vector>([
    [TeamID.TEAM_NEUTRAL, NEUTRAL_COLOR],
    [TeamID.TEAM_1, new rgba(216, 6, 249, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_2, new rgba(249, 95, 6, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_3, new rgba(39, 249, 6, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_4, new rgba(4, 103, 252, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_5, new rgba(249, 6, 6, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_6, new rgba(233, 249, 6, 1).NormalizeToLinear().AsModVector3()],
    [TeamID.TEAM_7, new rgba(133, 133, 133, 1).NormalizeToLinear().AsModVector3()]
]);
