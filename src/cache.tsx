import React, { memo } from 'react'
import _ from 'lodash';


export function memorizeComponent<T>(Component: React.FC<T>, compareFunction: (prev: T, next: T) => boolean) {
    return memo(Component, compareFunction);
}

export function compareReduxStoreOnly(prevProps: any, nextProps: any) {
    return _.isEqual(prevProps.reduxStore, nextProps.reduxStore);
}