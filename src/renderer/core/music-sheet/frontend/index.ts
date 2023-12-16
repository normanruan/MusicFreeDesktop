import Store from "@/common/store";
import * as backend from "../backend";
import defaultSheet from "../common/default-sheet";
import { useEffect, useRef, useState } from "react";
import { RequestStateCode } from "@/common/constant";

const musicSheetsStore = new Store<IMusic.IDBMusicSheetItem[]>([]);
const starredSheetsStore = new Store<IMedia.IMediaBase[]>([]);

export const useAllSheets = musicSheetsStore.useValue;
export const useAllStarredSheets = starredSheetsStore.useValue;

/** 更新默认歌单变化 */
const refreshFavCbs = new Set<() => void>();
function refreshFavoriteState() {
  refreshFavCbs.forEach((cb) => cb?.());
}

/**
 * 初始化
 */
export async function setupMusicSheets() {
  const [musicSheets, starredSheets] = await Promise.all([
    backend.queryAllSheets(),
    backend.queryAllStarredSheets(),
  ]);
  musicSheetsStore.setValue(musicSheets);
  starredSheetsStore.setValue(starredSheets);
}

/**
 * 新建歌单
 * @param sheetName 歌单名
 * @returns 新建的歌单信息
 */
export async function addSheet(sheetName: string) {
  try {
    const newSheetDetail = await backend.addSheet(sheetName);
    musicSheetsStore.setValue(backend.getAllSheets());
    return newSheetDetail;
  } catch {}
}

/**
 * 更新歌单信息
 * @param sheetId 歌单ID
 * @param newData 最新的歌单信息
 * @returns
 */
export async function updateSheet(
  sheetId: string,
  newData: Partial<IMusic.IMusicSheetItem>
) {
  try {
    await backend.updateSheet(sheetId, newData);
    musicSheetsStore.setValue(backend.getAllSheets());
  } catch {}
}

/**
 * 移除歌单
 * @param sheetId 歌单ID
 * @returns 删除后的ID
 */
export async function removeSheet(sheetId: string) {
  try {
    await backend.removeSheet(sheetId);
  } catch {}
}

/**
 * 收藏歌单
 * @param sheet
 */
export async function starMusicSheet(sheet: IMedia.IMediaBase) {
  await backend.starMusicSheet(sheet);
  starredSheetsStore.setValue(backend.getAllStarredSheets());
}

/**
 * 取消收藏歌单
 * @param sheet
 */
export async function unstarMusicSheet(sheet: IMedia.IMediaBase) {
  await backend.unstarMusicSheet(sheet);
  starredSheetsStore.setValue(backend.getAllStarredSheets());
}

/**
 * 收藏歌单排序
 */
export async function setStarredMusicSheets(sheets: IMedia.IMediaBase[]) {
  await backend.setStarredMusicSheets(sheets);
  starredSheetsStore.setValue(backend.getAllStarredSheets());
}

/**************************** 歌曲相关方法 ************************/

/**
 * 添加歌曲到歌单
 * @param musicItems
 * @param sheetId
 * @returns
 */
export async function addMusicToSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  const start = Date.now();
  await backend.addMusicToSheet(musicItems, sheetId);
  console.log("添加音乐", Date.now() - start, "ms");

  musicSheetsStore.setValue(backend.getAllSheets());
  if (sheetId === defaultSheet.id) {
    // 更新默认列表的状态
    refreshFavoriteState();
  }
  refreshSheetDetailState(sheetId);
}

/** 添加到默认歌单 */
export async function addMusicToFavorite(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  return addMusicToSheet(musicItems, defaultSheet.id);
}

/**
 * 从歌单内移除歌曲
 * @param musicItems 要移除的歌曲
 * @param sheetId 歌单ID
 * @returns
 */
export async function removeMusicFromSheet(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[],
  sheetId: string
) {
  const start = Date.now();
  await backend.removeMusicFromSheet(musicItems, sheetId);
  console.log("删除音乐", Date.now() - start, "ms");

  musicSheetsStore.setValue(backend.getAllSheets());
  if (sheetId === defaultSheet.id) {
    // 更新默认列表的状态
    refreshFavoriteState();
  }
  refreshSheetDetailState(sheetId);
}

/** 从默认歌单中移除 */
export async function removeMusicFromFavorite(
  musicItems: IMusic.IMusicItem | IMusic.IMusicItem[]
) {
  return removeMusicFromSheet(musicItems, defaultSheet.id);
}

/** 是否是我喜欢的歌单 */
export function isFavoriteMusic(musicItem: IMusic.IMusicItem) {
  return backend.isFavoriteMusic(musicItem);
}

/** hook 某首歌曲是否被标记成喜欢 */
export function useMusicIsFavorite(musicItem: IMusic.IMusicItem) {
  const [isFav, setIsFav] = useState(backend.isFavoriteMusic(musicItem));

  useEffect(() => {
    const cb = () => {
      setIsFav(backend.isFavoriteMusic(musicItem));
    };
    cb();
    refreshFavCbs.add(cb);
    return () => {
      refreshFavCbs.delete(cb);
    };
  }, [musicItem]);

  return isFav;
}

const updateSheetCbs: Map<string, Set<() => void>> = new Map();
function refreshSheetDetailState(sheetId: string) {
  updateSheetCbs.get(sheetId)?.forEach((cb) => cb?.());
}

/**
 * 监听当前某个歌单
 * @param sheetId 歌单ID
 * @param initQuery 是否重新查询
 */
export function useMusicSheet(sheetId: string) {
  const [pendingState, setPendingState] = useState(
    RequestStateCode.PENDING_FIRST_PAGE
  );
  const [sheetItem, setSheetItem] = useState<IMusic.IMusicSheetItem | null>(
    null
  );

  // 实时的sheetId
  const realTimeSheetIdRef = useRef(sheetId);
  realTimeSheetIdRef.current = sheetId;

  const pendingStateRef = useRef(pendingState);
  pendingStateRef.current = pendingState;

  useEffect(() => {
    const updateSheet = async () => {
      const start = Date.now();
      const sheetDetail = await backend.getSheetItemDetail(sheetId);
      console.log("歌单详情", Date.now() - start, "ms");
      if (realTimeSheetIdRef.current === sheetId) {
        console.log("歌单详情", sheetId);
        setSheetItem(sheetDetail);
        setPendingState(RequestStateCode.FINISHED);
      }
    };

    const updateSheetCallback = async () => {
      if (!(pendingStateRef.current & RequestStateCode.LOADING)) {
        setPendingState(RequestStateCode.PENDING_REST_PAGE);
        await updateSheet();
      }
    };

    const cbs = updateSheetCbs.get(sheetId) ?? new Set();
    cbs.add(updateSheetCallback);
    updateSheetCbs.set(sheetId, cbs);

    const targetSheet = musicSheetsStore
      .getValue()
      .find((item) => item.id === sheetId);

    if (targetSheet) {
      setSheetItem({
        ...targetSheet,
        musicList: [],
      });
    }

    setPendingState(RequestStateCode.PENDING_FIRST_PAGE);
    updateSheet();

    return () => {
      cbs?.delete(updateSheetCallback);
    };
  }, [sheetId]);

  return [sheetItem, pendingState] as const;
}

export async function exportAllSheetDetails() {
  return await backend.exportAllSheetDetails();
}
